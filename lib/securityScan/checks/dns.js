import { Resolver } from "node:dns/promises";

function makeResolver() {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  return resolver;
}

export async function resolveTxt(name) {
  try {
    const records = await makeResolver().resolveTxt(name);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export async function resolveMx(domain) {
  try {
    const records = await makeResolver().resolveMx(domain);
    return records.sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

export async function resolveA(domain) {
  try {
    return await makeResolver().resolve4(domain);
  } catch {
    return [];
  }
}

export async function resolveCname(name) {
  try {
    return await makeResolver().resolveCname(name);
  } catch {
    return [];
  }
}

export async function resolveCaa(domain) {
  try {
    return await makeResolver().resolveCaa(domain);
  } catch {
    return [];
  }
}

const passiveSubdomainCandidates = [
  "www", "mail", "autodiscover", "autoconfig", "mta-sts", "smtp", "imap", "pop", "vpn", "remote", "portal", "app", "api", "crm", "admin", "login", "shop", "status", "support", "help", "dev", "test", "staging"
];

export async function discoverSubdomains(domain) {
  const results = await Promise.all(passiveSubdomainCandidates.map(async (label) => {
    const host = `${label}.${domain}`;
    const [a, cname] = await Promise.all([resolveA(host), resolveCname(host)]);
    if (!a.length && !cname.length) return null;
    return { host, a, cname };
  }));

  return results.filter(Boolean).sort((a, b) => a.host.localeCompare(b.host));
}

export async function checkDnssec(domain) {
  try {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return { enabled: null };
    const data = await response.json();
    return { enabled: data.AD === true };
  } catch {
    return { enabled: null };
  }
}
