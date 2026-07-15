/**
 * Passive exposed-backend check (Phoenix Scan).
 *
 * Ethics / legal bounds:
 * - Only fetches publicly reachable HTML/JS from the target origin.
 * - Supabase confirmation is one non-destructive GET per known table name
 *   with select=*&limit=1 — never write, delete, or enumerate beyond the fixed list.
 * - Response bodies are not logged; only table name + row count are retained.
 * - Must only run when SCANNER_ALLOW_ACTIVE_SCAN is enabled and scan authorization
 *   is signed for the domain (enforced by callers).
 */

import { assertPublicTarget } from "../guards.js";

const UA = "PhoenixScan/1.0 (+https://scan.hansen-it.com)";
const MAX_SCRIPTS = 10;
const MAX_SCRIPT_BYTES = 2 * 1024 * 1024;
const SCRIPT_TIMEOUT_MS = 8000;
const RLS_DELAY_MS = 200;
const MAX_RLS_CALLS = 12;

/** Fixed allowlist — not discovery/enumeration. */
export const COMMON_TABLES = [
  "users",
  "profiles",
  "customers",
  "orders",
  "invoices",
  "leads",
  "contacts",
  "messages",
  "bookings",
  "payments",
  "subscriptions",
  "admin_profiles",
];

const RE_SUPABASE_URL = /https:\/\/([a-z0-9]{20})\.supabase\.co/gi;
const RE_JWT = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const RE_FIREBASE = /apiKey["\s:]+(AIza[0-9A-Za-z_-]{35})/g;
const RE_AIRTABLE = /\b(key[0-9a-zA-Z]{14})\b/g;
const RE_STRIPE_LIVE = /\b(pk_live_[0-9a-zA-Z]{24})\b/g;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function sameOriginScriptUrls(html, originHost) {
  const urls = [];
  const re = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    try {
      const absolute = new URL(match[1], `https://${originHost}/`);
      if (absolute.protocol !== "https:" && absolute.protocol !== "http:") continue;
      if (absolute.hostname !== originHost && absolute.hostname !== `www.${originHost}`) {
        // Allow www ↔ apex same site
        const a = absolute.hostname.replace(/^www\./, "");
        const b = originHost.replace(/^www\./, "");
        if (a !== b) continue;
      }
      urls.push(absolute.href);
    } catch {
      // ignore bad URLs
    }
  }
  return [...new Set(urls)].slice(0, MAX_SCRIPTS);
}

async function fetchText(url, { maxBytes = MAX_SCRIPT_BYTES, timeoutMs = SCRIPT_TIMEOUT_MS } = {}) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "user-agent": UA, accept: "*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") || 0);
  if (len > maxBytes) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) return null;
  return buf.toString("utf8");
}

function collectMatches(text) {
  const supabaseUrls = new Map(); // ref -> url
  const jwts = [];
  const firebase = new Set();
  const airtable = new Set();
  const stripe = new Set();

  for (const m of text.matchAll(RE_SUPABASE_URL)) {
    const ref = m[1];
    supabaseUrls.set(ref, `https://${ref}.supabase.co`);
  }

  for (const m of text.matchAll(RE_JWT)) {
    const token = m[0];
    const payload = decodeJwtPayload(token);
    if (!payload) continue;
    const role = payload.role || payload.rol || null;
    if (role !== "anon" && role !== "service_role") continue;
    const ref = payload.ref || null;
    jwts.push({ token, role, ref });
  }

  for (const m of text.matchAll(RE_FIREBASE)) firebase.add(m[1]);
  for (const m of text.matchAll(RE_AIRTABLE)) airtable.add(m[1]);
  for (const m of text.matchAll(RE_STRIPE_LIVE)) stripe.add(m[1]);

  return {
    supabaseUrls,
    jwts,
    firebase: [...firebase],
    airtable: [...airtable],
    stripe: [...stripe],
  };
}

/**
 * Fetch homepage + same-origin scripts and extract backend key patterns.
 * @param {string} domain
 */
export async function findExposedBackendKeys(domain) {
  const host = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];

  if (!host) {
    return { domain: host, scriptsChecked: 0, supabase: [], firebase: [], airtable: [], stripe: [] };
  }

  await assertPublicTarget(host);

  let html = null;
  let originHost = host;
  try {
    html = await fetchText(`https://${host}/`, { maxBytes: MAX_SCRIPT_BYTES, timeoutMs: SCRIPT_TIMEOUT_MS });
  } catch {
    html = null;
  }

  if (!html) {
    try {
      originHost = `www.${host}`;
      await assertPublicTarget(originHost);
      html = await fetchText(`https://${originHost}/`, { maxBytes: MAX_SCRIPT_BYTES, timeoutMs: SCRIPT_TIMEOUT_MS });
    } catch {
      html = null;
    }
  }

  if (!html) {
    return { domain: host, scriptsChecked: 0, supabase: [], firebase: [], airtable: [], stripe: [] };
  }

  const scriptUrls = sameOriginScriptUrls(html, originHost);
  const scriptTexts = await Promise.all(
    scriptUrls.map(async (url) => {
      try {
        return await fetchText(url);
      } catch {
        return null;
      }
    })
  );

  const blobs = [html, ...scriptTexts.filter(Boolean)];
  const mergedUrls = new Map();
  const jwtByToken = new Map();
  const firebase = new Set();
  const airtable = new Set();
  const stripe = new Set();

  for (const blob of blobs) {
    const found = collectMatches(blob);
    for (const [ref, url] of found.supabaseUrls) mergedUrls.set(ref, url);
    for (const jwt of found.jwts) {
      if (!jwtByToken.has(jwt.token)) jwtByToken.set(jwt.token, jwt);
    }
    for (const k of found.firebase) firebase.add(k);
    for (const k of found.airtable) airtable.add(k);
    for (const k of found.stripe) stripe.add(k);
  }

  // Pair JWTs with project URLs via ref (or sole project if only one URL found)
  const supabase = [];
  const seen = new Set();
  for (const jwt of jwtByToken.values()) {
    let url = jwt.ref ? mergedUrls.get(jwt.ref) : null;
    if (!url && mergedUrls.size === 1) {
      url = [...mergedUrls.values()][0];
    }
    if (!url && jwt.ref) {
      url = `https://${jwt.ref}.supabase.co`;
    }
    if (!url) continue;
    const key = `${url}|${jwt.role}|${jwt.token.slice(0, 24)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    supabase.push({
      url,
      ref: jwt.ref || (url.match(/https:\/\/([a-z0-9]{20})\.supabase\.co/i)?.[1] ?? null),
      role: jwt.role,
      key: jwt.token,
      serviceRoleLeaked: jwt.role === "service_role",
    });
  }

  // URL without JWT still noted for evidence (no RLS probe without a key)
  for (const [ref, url] of mergedUrls) {
    if (supabase.some((s) => s.ref === ref || s.url === url)) continue;
    supabase.push({ url, ref, role: null, key: null, serviceRoleLeaked: false });
  }

  return {
    domain: host,
    scriptsChecked: scriptUrls.length,
    supabase,
    firebase: [...firebase].map((apiKey) => ({ apiKey })),
    airtable: [...airtable].map((key) => ({ key })),
    stripe: [...stripe].map((publishableKey) => ({ publishableKey })),
  };
}

/**
 * Non-destructive RLS probe: GET rest/v1/<table>?select=*&limit=1 for a fixed table list.
 * Max 12 calls, 200 ms apart. Does not log response content.
 * @param {string} supabaseUrl
 * @param {string} anonKey
 */
export async function testSupabaseRls(supabaseUrl, anonKey) {
  const base = String(supabaseUrl || "").replace(/\/+$/, "");
  const key = String(anonKey || "").trim();
  if (!base || !key) return [];

  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    return [];
  }

  await assertPublicTarget(host);

  const results = [];
  const tables = COMMON_TABLES.slice(0, MAX_RLS_CALLS);

  for (let i = 0; i < tables.length; i++) {
    if (i > 0) await sleep(RLS_DELAY_MS);
    const table = tables[i];
    const url = `${base}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`;

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          "user-agent": UA,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (res.status === 404) continue;

      if (res.status === 401 || res.status === 403) {
        results.push({ table, exposed: false, rowCount: 0, status: "protected" });
        continue;
      }

      if (res.status === 200) {
        let rowCount = 0;
        try {
          const data = await res.json();
          rowCount = Array.isArray(data) ? data.length : data ? 1 : 0;
        } catch {
          rowCount = 0;
        }
        // Do not retain or log row contents — only count.
        results.push({
          table,
          exposed: rowCount > 0,
          rowCount,
          status: rowCount > 0 ? "exposed" : "empty_or_blocked",
        });
        continue;
      }

      // Other statuses: ignore quietly
    } catch {
      // soft-fail per table
    }
  }

  return results;
}

/**
 * Full check: key discovery + RLS confirmation for anon keys.
 * Callers must gate on SCANNER_ALLOW_ACTIVE_SCAN + signed authorization.
 */
export async function checkExposedBackend(domain) {
  const keys = await findExposedBackendKeys(domain).catch(() => ({
    domain,
    scriptsChecked: 0,
    supabase: [],
    firebase: [],
    airtable: [],
    stripe: [],
  }));

  const rlsByProject = [];
  const anonProjects = (keys.supabase || []).filter((s) => s.key && s.role === "anon" && s.url);

  for (const project of anonProjects) {
    const tables = await testSupabaseRls(project.url, project.key).catch(() => []);
    rlsByProject.push({
      url: project.url,
      ref: project.ref,
      tables,
      exposedTables: tables.filter((t) => t.exposed).map((t) => t.table),
    });
  }

  return {
    ...keys,
    rls: rlsByProject,
    ran: true,
  };
}

/** Empty result when active check is not authorized to run. */
export function skippedExposedBackend(reason = "not_authorized") {
  return {
    domain: null,
    scriptsChecked: 0,
    supabase: [],
    firebase: [],
    airtable: [],
    stripe: [],
    rls: [],
    ran: false,
    skipped: true,
    skipReason: reason,
  };
}

export function isActiveScanAllowed() {
  return process.env.SCANNER_ALLOW_ACTIVE_SCAN === "true";
}
