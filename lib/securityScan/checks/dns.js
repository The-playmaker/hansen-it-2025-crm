import { Resolver } from "node:dns/promises";

// Egen resolver med offentlige DNS-servere (mer forutsigbart på Vercel)
function makeResolver() {
  const r = new Resolver({ timeout: 4000, tries: 2 });
  r.setServers(["1.1.1.1", "8.8.8.8"]);
  return r;
}

export async function resolveTxt(name) {
  try {
    const r = makeResolver();
    const records = await r.resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export async function resolveMx(domain) {
  try {
    const r = makeResolver();
    const records = await r.resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

export async function resolveA(domain) {
  try {
    const r = makeResolver();
    return await r.resolve4(domain);
  } catch {
    return [];
  }
}

export async function resolveCaa(domain) {
  try {
    const r = makeResolver();
    return await r.resolveCaa(domain);
  } catch {
    return [];
  }
}

// DNSSEC: sjekker AD-flagget (Authenticated Data) via DNS-over-HTTPS.
// Cloudflare validerer DNSSEC, så ad=true betyr at sonen er signert og gyldig.
export async function checkDnssec(domain) {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { enabled: null };
    const data = await res.json();
    return { enabled: data.AD === true };
  } catch {
    return { enabled: null }; // ukjent, ikke feil
  }
}
