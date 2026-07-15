import { Resolver } from "node:dns/promises";

const resolver = new Resolver({ timeout: 4000, tries: 2 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

const knownTlds = new Set([
  "agency",
  "ai",
  "app",
  "as",
  "band",
  "bar",
  "biz",
  "blog",
  "build",
  "cafe",
  "capital",
  "care",
  "center",
  "cloud",
  "co",
  "com",
  "company",
  "consulting",
  "design",
  "dev",
  "digital",
  "dk",
  "email",
  "energy",
  "engineering",
  "eu",
  "events",
  "expert",
  "farm",
  "finance",
  "fish",
  "fitness",
  "group",
  "guru",
  "help",
  "host",
  "industries",
  "info",
  "institute",
  "insure",
  "io",
  "it",
  "land",
  "law",
  "life",
  "link",
  "live",
  "ltd",
  "management",
  "market",
  "media",
  "net",
  "news",
  "ninja",
  "no",
  "one",
  "online",
  "org",
  "partners",
  "photo",
  "plus",
  "pro",
  "properties",
  "pub",
  "rocks",
  "run",
  "sale",
  "school",
  "se",
  "services",
  "shop",
  "show",
  "site",
  "social",
  "solutions",
  "space",
  "store",
  "studio",
  "supply",
  "support",
  "systems",
  "team",
  "tech",
  "technology",
  "today",
  "tools",
  "tours",
  "trade",
  "training",
  "travel",
  "tv",
  "university",
  "vet",
  "video",
  "website",
  "wiki",
  "works",
  "world",
  "xyz",
  "zone",
]);

const domainPattern = /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i;

export function parseDomainList(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeDomain(item)).filter(Boolean);
  return String(value || "")
    .split(/[\n,;]/)
    .map((item) => normalizeDomain(item))
    .filter(Boolean);
}

export function normalizeDomain(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0];
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

/**
 * Suggest a corrected domain when the TLD looks like a typo (Levenshtein ≤ 2).
 * Exported so scan API / runners can offer "Mente du …?" before generating a report.
 */
export function suggestedDomain(domain) {
  const { sld, tld } = domainParts(domain);
  if (!sld || !tld) return null;
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
    safe(() => resolver.resolveNs(domain)),
  ]);
  return { a, aaaa, mx, ns };
}

/**
 * DNS presence for scan gating.
 *
 * - empty: A, AAAA, MX and NS are all empty → domain is not in use (block scan)
 * - registeredEmpty: has NS but no A/AAAA/MX → registered zone, no services (allow scan + finding)
 * - Email-only (MX present, no A) is NOT empty and must be allowed.
 */
export async function assessDomainDns(domain) {
  const records = await resolveRecords(domain);
  const hasA = records.a.length > 0;
  const hasAaaa = records.aaaa.length > 0;
  const hasMx = records.mx.length > 0;
  const hasNs = records.ns.length > 0;
  const empty = !hasA && !hasAaaa && !hasMx && !hasNs;
  const registeredEmpty = hasNs && !hasA && !hasAaaa && !hasMx;
  return {
    a: records.a,
    aaaa: records.aaaa,
    mx: records.mx,
    ns: records.ns,
    empty,
    registeredEmpty,
    suggestion: empty ? suggestedDomain(domain) : null,
  };
}

export class InvalidDomainError extends Error {
  constructor(domain, suggestion = null) {
    const hint = suggestion ? ` Mente du ${suggestion}?` : "";
    super(
      `Vi fant ingen DNS-oppføringer for ${domain}. Domenet ser ikke ut til å være i bruk.${hint}`
    );
    this.name = "InvalidDomainError";
    this.code = "invalid_domain";
    this.domain = domain;
    this.suggestion = suggestion;
  }
}

export async function validateScanDomains(domains) {
  const normalized = [...new Set(parseDomainList(domains))];
  const results = [];

  for (const domain of normalized) {
    const { tld } = domainParts(domain);
    const formatValid = domainPattern.test(domain);
    const tldKnown = knownTlds.has(tld);
    const suggestion = formatValid ? suggestedDomain(domain) : null;
    const records = formatValid
      ? await resolveRecords(domain)
      : { a: [], aaaa: [], mx: [], ns: [] };
    const hasDnsRecords = Boolean(
      records.a.length || records.aaaa.length || records.mx.length || records.ns.length
    );
    const warnings = [];

    if (!formatValid) warnings.push("Domenet har ugyldig format.");
    if (formatValid && !tldKnown) warnings.push("TLD ser ukjent eller mistenkelig ut.");
    if (formatValid && suggestion) warnings.push(`Mener du ${suggestion}?`);
    if (formatValid && !hasDnsRecords) {
      warnings.push("Fant ingen DNS records – sjekk skrivefeil før du signerer.");
    }

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
        ns: records.ns,
      },
      hasDnsRecords,
      warnings,
    });
  }

  return {
    domains: normalized,
    results,
    invalid: results.filter((item) => !item.formatValid),
    warnings: results.filter((item) => item.warnings.length),
    requiresOverride: results.some((item) => item.formatValid && !item.hasDnsRecords),
  };
}
