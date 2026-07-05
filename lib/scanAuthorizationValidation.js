import { Resolver } from "node:dns/promises";

const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const knownTlds = new Set([
  "agency", "app", "as", "biz", "cloud", "co", "com", "dev", "digital", "dk", "io", "it", "net", "no", "org", "se", "tech"
]);

const domainPattern = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

export function parseDomainList(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeDomain(item)).filter(Boolean);
  return String(value || "").split(/[\n,;]/).map((item) => normalizeDomain(item)).filter(Boolean);
}

export function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, index) => [index]);
  for (let j = 1; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return matrix[a.length][b.length];
}

function domainParts(domain) {
  const parts = domain.split(".");
  return { sld: parts.slice(0, -1).join("."), tld: parts.at(-1) || "" };
}

function suggestedDomain(domain) {
  const { sld, tld } = domainParts(domain);
  let best = null;
  for (const known of knownTlds) {
    const distance = levenshtein(tld, known);
    if (!best || distance < best.distance) best = { tld: known, distance };
  }
  if (best && best.distance > 0 && best.distance <= 2) return `${sld}.${best.tld}`;
  return null;
}

async function resolveRecords(domain) {
  const safe = async (fn) => {
    try {
      return await fn();
    } catch {
      return [];
    }
  };
  const [a, aaaa, mx, ns] = await Promise.all([
    safe(() => resolver.resolve4(domain)),
    safe(() => resolver.resolve6(domain)),
    safe(() => resolver.resolveMx(domain)),
    safe(() => resolver.resolveNs(domain))
  ]);
  return { a, aaaa, mx, ns };
}

export async function validateScanDomains(domains) {
  const normalized = [...new Set(parseDomainList(domains))];
  const results = [];

  for (const domain of normalized) {
    const { tld } = domainParts(domain);
    const formatValid = domainPattern.test(domain);
    const tldKnown = knownTlds.has(tld);
    const suggestion = formatValid ? suggestedDomain(domain) : null;
    const records = formatValid ? await resolveRecords(domain) : { a: [], aaaa: [], mx: [], ns: [] };
    const hasDnsRecords = Boolean(records.a.length || records.aaaa.length || records.mx.length || records.ns.length);
    const warnings = [];

    if (!formatValid) warnings.push("Domenet har ugyldig format.");
    if (formatValid && !tldKnown) warnings.push("TLD ser ukjent eller mistenkelig ut.");
    if (formatValid && suggestion) warnings.push(`Mener du ${suggestion}?`);
    if (formatValid && !hasDnsRecords) warnings.push("Fant ingen DNS records – sjekk skrivefeil før du signerer.");

    results.push({
      domain,
      formatValid,
      tld,
      tldKnown,
      suggestion,
      dns: {
        a: records.a,
        aaaa: records.aaaa,
        mx: records.mx.map((item) => item.exchange || item),
        ns: records.ns
      },
      hasDnsRecords,
      warnings
    });
  }

  return {
    domains: normalized,
    results,
    invalid: results.filter((item) => !item.formatValid),
    warnings: results.filter((item) => item.warnings.length),
    requiresOverride: results.some((item) => item.formatValid && !item.hasDnsRecords)
  };
}
