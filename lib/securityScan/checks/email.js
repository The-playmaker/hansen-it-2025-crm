import net, { isIP } from "node:net";
import { resolveA, resolveAAAA, resolveMx, resolveTxt } from "./dns.js";

const DKIM_SELECTORS = [
  "selector1",
  "selector2",
  "google",
  "default",
  "dkim",
  "k1",
  "k2",
  "s1",
  "s2",
  "mail",
  "smtp",
  "resend",
  "zendesk1",
  "zendesk2",
  "mandrill",
  "sendgrid",
  "mailjet",
  "sm",
  "key1",
  "protonmail",
  "protonmail2",
  "protonmail3",
  "fm1",
  "fm2",
  "fm3",
  "everlytickey1",
  "everlytickey2",
  "krs",
];

const SPF_LOOKUP_LIMIT = 10;
const SPF_MAX_DEPTH = 3;
const SPF_MAX_LOOKUPS_HARD_CAP = 25;

function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function tokenizeSpf(record) {
  return String(record || "")
    .replace(/^v=spf1\s*/i, "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripSpfQualifier(term) {
  return term.replace(/^[+\-~?]/, "");
}

async function countSpfLookups(record, depth = 0, state = { lookupCount: 0, hasPtr: false, visited: new Set() }) {
  if (!record || depth > SPF_MAX_DEPTH || state.lookupCount >= SPF_MAX_LOOKUPS_HARD_CAP) {
    return state;
  }

  for (const raw of tokenizeSpf(record)) {
    if (state.lookupCount >= SPF_MAX_LOOKUPS_HARD_CAP) break;
    const term = stripSpfQualifier(raw).toLowerCase();

    if (term.startsWith("include:")) {
      state.lookupCount += 1;
      const included = raw.replace(/^[+\-~?]?include:/i, "").trim();
      if (!included || state.visited.has(included.toLowerCase())) continue;
      state.visited.add(included.toLowerCase());
      const nestedRecords = await withTimeout(resolveTxt(included), 4000, []);
      const nestedSpf = nestedRecords.find((t) => t.toLowerCase().startsWith("v=spf1"));
      if (nestedSpf) await countSpfLookups(nestedSpf, depth + 1, state);
      continue;
    }

    if (term.startsWith("redirect=")) {
      state.lookupCount += 1;
      const redirected = raw.replace(/^[+\-~?]?redirect=/i, "").trim();
      if (!redirected || state.visited.has(`redirect:${redirected.toLowerCase()}`)) continue;
      state.visited.add(`redirect:${redirected.toLowerCase()}`);
      const nestedRecords = await withTimeout(resolveTxt(redirected), 4000, []);
      const nestedSpf = nestedRecords.find((t) => t.toLowerCase().startsWith("v=spf1"));
      if (nestedSpf) await countSpfLookups(nestedSpf, depth + 1, state);
      continue;
    }

    if (term === "a" || term.startsWith("a:") || term.startsWith("a/")) {
      state.lookupCount += 1;
      continue;
    }

    if (term === "mx" || term.startsWith("mx:") || term.startsWith("mx/")) {
      state.lookupCount += 1;
      continue;
    }

    if (term === "ptr" || term.startsWith("ptr:")) {
      state.lookupCount += 1;
      state.hasPtr = true;
      continue;
    }

    if (term.startsWith("exists:")) {
      state.lookupCount += 1;
    }
  }

  return state;
}

async function analyzeSpf(domain, spfRecords) {
  const records = spfRecords.filter((t) => t.toLowerCase().startsWith("v=spf1"));
  const multipleRecords = records.length > 1;
  const record = records[0] || null;

  let policy = null;
  if (record) {
    const lower = ` ${record.toLowerCase()} `;
    if (/\s-all\s/.test(lower)) policy = "strict";
    else if (/\s~all\s/.test(lower)) policy = "soft";
    else if (/\s\?all\s/.test(lower)) policy = "neutral";
    else if (/\s\+all\s/.test(lower) || /\sall\s/.test(lower)) policy = "open";
    else policy = "none";
  }

  let lookupCount = 0;
  let hasPtr = false;
  if (record) {
    try {
      const state = await withTimeout(
        countSpfLookups(record),
        12000,
        { lookupCount: 0, hasPtr: false, visited: new Set() }
      );
      lookupCount = state.lookupCount || 0;
      hasPtr = Boolean(state.hasPtr);
    } catch {
      lookupCount = 0;
      hasPtr = false;
    }
  }

  return {
    present: Boolean(record),
    policy,
    record,
    lookupCount,
    exceedsLookupLimit: lookupCount > SPF_LOOKUP_LIMIT,
    multipleRecords,
    hasPtr,
  };
}

function parseDmarcTags(record) {
  const tags = {};
  for (const part of String(record || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim().toLowerCase();
    const value = trimmed.slice(idx + 1).trim();
    if (key) tags[key] = value;
  }
  return tags;
}

function extractMailDomains(uriList) {
  return String(uriList || "")
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const mailto = part.match(/^mailto:([^!@\s]+)@([^!?\s]+)/i);
      if (mailto) return mailto[2].toLowerCase().replace(/\.$/, "");
      try {
        const url = new URL(part);
        return url.hostname.toLowerCase().replace(/\.$/, "");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function isSameOrSubdomain(host, domain) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  const d = String(domain || "").toLowerCase().replace(/\.$/, "");
  return h === d || h.endsWith(`.${d}`);
}

async function verifyExternalRua(domain, rua) {
  const targets = extractMailDomains(rua);
  if (!targets.length) return null;

  const external = targets.filter((host) => !isSameOrSubdomain(host, domain));
  if (!external.length) return true;

  try {
    const checks = await Promise.all(
      external.map(async (ruaDomain) => {
        const name = `${domain}._report._dmarc.${ruaDomain}`;
        const records = await withTimeout(resolveTxt(name), 4000, []);
        return records.some((t) => /v\s*=\s*dmarc1/i.test(t));
      })
    );
    return checks.every(Boolean);
  } catch {
    return null;
  }
}

async function analyzeDmarc(domain, dmarcRecords) {
  const record = dmarcRecords.find((t) => t.toLowerCase().startsWith("v=dmarc1")) || null;
  if (!record) {
    return {
      present: false,
      policy: null,
      record: null,
      rua: null,
      ruf: null,
      pct: null,
      sp: null,
      adkim: null,
      aspf: null,
      hasReporting: false,
      externalRuaVerified: null,
    };
  }

  const tags = parseDmarcTags(record);
  const policy = String(tags.p || "none").toLowerCase();
  const rua = tags.rua || null;
  const ruf = tags.ruf || null;
  const pct = tags.pct != null ? Number(tags.pct) : 100;
  const sp = tags.sp ? String(tags.sp).toLowerCase() : null;
  const adkim = tags.adkim ? String(tags.adkim).toLowerCase() : "r";
  const aspf = tags.aspf ? String(tags.aspf).toLowerCase() : "r";
  const hasReporting = Boolean(rua || ruf);
  const externalRuaVerified = rua ? await verifyExternalRua(domain, rua) : null;

  return {
    present: true,
    policy,
    record,
    rua,
    ruf,
    pct: Number.isFinite(pct) ? pct : 100,
    sp,
    adkim,
    aspf,
    hasReporting,
    externalRuaVerified,
  };
}

function rsaKeyBitsFromDkimP(pValue) {
  if (!pValue) return null;
  try {
    const der = Buffer.from(String(pValue).replace(/\s+/g, ""), "base64");
    if (!der.length) return 0;

    let maxBits = 0;
    let i = 0;
    while (i < der.length - 1) {
      if (der[i] !== 0x02) {
        i += 1;
        continue;
      }
      let len = der[i + 1];
      let header = 2;
      if (len & 0x80) {
        const n = len & 0x7f;
        if (n <= 0 || i + 1 + n >= der.length) {
          i += 1;
          continue;
        }
        len = 0;
        for (let j = 0; j < n; j += 1) len = (len << 8) | der[i + 2 + j];
        header = 2 + n;
      }
      if (len <= 0 || i + header + len > der.length) {
        i += 1;
        continue;
      }
      let bits = len * 8;
      if (der[i + header] === 0x00) bits -= 8;
      if (bits > maxBits) maxBits = bits;
      i += header + len;
    }

    if (maxBits > 0) return maxBits;
    return der.length * 8;
  } catch {
    return null;
  }
}

function parseDkimRecord(record) {
  const tags = {};
  for (const part of String(record || "").split(";")) {
    const trimmed = part.trim();
    if (!trimmed || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    tags[trimmed.slice(0, idx).trim().toLowerCase()] = trimmed.slice(idx + 1).trim();
  }
  const p = Object.prototype.hasOwnProperty.call(tags, "p") ? tags.p : null;
  const revoked = p === "";
  const testMode = String(tags.t || "")
    .toLowerCase()
    .split(":")
    .some((flag) => flag === "y");
  const keyBits = revoked ? 0 : rsaKeyBitsFromDkimP(p);
  return { keyBits, testMode, revoked };
}

async function analyzeDkim(domain) {
  const details = [];
  await Promise.all(
    DKIM_SELECTORS.map(async (selector) => {
      try {
        const txt = await withTimeout(resolveTxt(`${selector}._domainkey.${domain}`), 4000, []);
        const rec = txt.find((t) => /v\s*=\s*dkim1/i.test(t) || /\bp\s*=/i.test(t));
        if (!rec) return;
        const parsed = parseDkimRecord(rec);
        details.push({
          selector,
          keyBits: parsed.keyBits,
          testMode: parsed.testMode,
          revoked: parsed.revoked,
        });
      } catch {
        // soft-fail per selector
      }
    })
  );

  details.sort((a, b) => a.selector.localeCompare(b.selector));
  return {
    present: details.length > 0,
    selectors: details.map((item) => item.selector),
    selectorDetails: details,
  };
}

function probeStarttls(host) {
  return new Promise((resolve) => {
    let settled = false;
    let buffer = "";
    let stage = "banner";

    const finish = (value) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(value);
    };

    const socket = net.connect({ host, port: 25 });
    socket.setTimeout(5000);
    socket.setEncoding("utf8");

    socket.on("data", (chunk) => {
      buffer += chunk;
      if (stage === "banner" && /(^|\r?\n)220[\s-]/.test(buffer)) {
        stage = "ehlo";
        buffer = "";
        socket.write("EHLO phoenix-scan.hansen-it.com\r\n");
        return;
      }
      if (stage === "ehlo" && /(^|\r?\n)250 /.test(buffer)) {
        const supports = /STARTTLS/i.test(buffer);
        stage = "done";
        socket.write("QUIT\r\n");
        finish(supports);
      }
    });

    socket.on("timeout", () => finish(null));
    socket.on("error", () => finish(null));
    socket.on("close", () => {
      if (!settled) finish(null);
    });
  });
}

async function analyzeMxHealth(domain, mxRecords, hasSpfOrDmarc) {
  const hosts = (mxRecords || []).map((item) => String(item.exchange || "").replace(/\.$/, "")).filter(Boolean);
  const details = [];

  for (const host of hosts) {
    const pointsToIp = isIP(host) !== 0;
    let resolves = false;
    let addresses = [];
    if (!pointsToIp) {
      try {
        const [a, aaaa] = await Promise.all([
          withTimeout(resolveA(host), 4000, []),
          withTimeout(resolveAAAA(host), 4000, []),
        ]);
        addresses = [...a, ...aaaa];
        resolves = addresses.length > 0;
      } catch {
        resolves = false;
      }
    } else {
      resolves = true;
      addresses = [host];
    }
    details.push({ host, pointsToIp, resolves, addresses });
  }

  const unresolvedHosts = details.filter((item) => !item.resolves).map((item) => item.host);
  const ipLiteralHosts = details.filter((item) => item.pointsToIp).map((item) => item.host);
  const missingMxWithAuth = !hosts.length && hasSpfOrDmarc;

  let starttls = null;
  const primary = details.find((item) => item.resolves && !item.pointsToIp);
  if (primary) {
    try {
      starttls = await withTimeout(probeStarttls(primary.host), 5500, null);
    } catch {
      starttls = null;
    }
  }

  return {
    hosts,
    details,
    unresolvedHosts,
    ipLiteralHosts,
    missingMxWithAuth,
    starttls,
  };
}

async function analyzeBimi(domain) {
  try {
    const records = await withTimeout(resolveTxt(`default._bimi.${domain}`), 4000, []);
    const record = records.find((t) => /v\s*=\s*bimi1/i.test(t)) || null;
    if (!record) return { present: false, hasVmc: false, record: null };
    const hasVmc = /(?:^|;)\s*a\s*=\s*https?:\/\//i.test(record);
    return { present: true, hasVmc, record };
  } catch {
    return { present: false, hasVmc: false, record: null };
  }
}

export async function checkEmail(domain) {
  const [spfRecords, dmarcRecords, mx, mtaSts, tlsRpt] = await Promise.all([
    withTimeout(resolveTxt(domain), 5000, []),
    withTimeout(resolveTxt(`_dmarc.${domain}`), 5000, []),
    withTimeout(resolveMx(domain), 5000, []),
    withTimeout(resolveTxt(`_mta-sts.${domain}`), 5000, []),
    withTimeout(resolveTxt(`_smtp._tls.${domain}`), 5000, []),
  ]);

  const [spf, dmarc, dkim, bimi] = await Promise.all([
    analyzeSpf(domain, spfRecords).catch(() => ({
      present: false,
      policy: null,
      record: null,
      lookupCount: 0,
      exceedsLookupLimit: false,
      multipleRecords: false,
      hasPtr: false,
    })),
    analyzeDmarc(domain, dmarcRecords).catch(() => ({
      present: false,
      policy: null,
      record: null,
      rua: null,
      ruf: null,
      pct: null,
      sp: null,
      adkim: null,
      aspf: null,
      hasReporting: false,
      externalRuaVerified: null,
    })),
    analyzeDkim(domain).catch(() => ({ present: false, selectors: [], selectorDetails: [] })),
    analyzeBimi(domain),
  ]);

  const mxHealth = await analyzeMxHealth(domain, mx, spf.present || dmarc.present).catch(() => ({
    hosts: (mx || []).map((item) => item.exchange),
    details: [],
    unresolvedHosts: [],
    ipLiteralHosts: [],
    missingMxWithAuth: false,
    starttls: null,
  }));

  return {
    hasMx: mx.length > 0,
    mx: mx.map((m) => m.exchange),
    spf,
    dmarc,
    dkim,
    mtaSts: mtaSts.some((t) => t.toLowerCase().startsWith("v=stsv1")),
    tlsRpt: tlsRpt.some((t) => t.toLowerCase().startsWith("v=tlsrptv1")),
    mxHealth,
    bimi,
  };
}
