import { Resolver } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

const INTERNAL_MESSAGE = "Kan ikke skanne interne adresser.";

const privateBlockList = new BlockList();
// IPv4
privateBlockList.addSubnet("0.0.0.0", 8, "ipv4");
privateBlockList.addSubnet("10.0.0.0", 8, "ipv4");
privateBlockList.addSubnet("100.64.0.0", 10, "ipv4");
privateBlockList.addSubnet("127.0.0.0", 8, "ipv4");
privateBlockList.addSubnet("169.254.0.0", 16, "ipv4");
privateBlockList.addSubnet("172.16.0.0", 12, "ipv4");
privateBlockList.addSubnet("192.168.0.0", 16, "ipv4");
// IPv6
privateBlockList.addSubnet("::1", 128, "ipv6");
privateBlockList.addSubnet("fc00::", 7, "ipv6");
privateBlockList.addSubnet("fe80::", 10, "ipv6");

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

function makeResolver() {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  return resolver;
}

/**
 * Returns true for private, loopback, link-local, CGNAT and unique-local addresses.
 */
export function isPrivateIp(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!value) return false;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice(7);
    if (isIP(mapped) === 4) return isPrivateIp(mapped);
  }

  const version = isIP(value);
  if (!version) return false;

  return privateBlockList.check(value, version === 4 ? "ipv4" : "ipv6");
}

function isBlockedHostname(host) {
  if (!host) return true;
  if (host === "localhost") return true;
  return BLOCKED_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

/**
 * Resolves A/AAAA for the target and rejects private/internal destinations (SSRF guard).
 * Must run after DNS lookup so public names that rebind to 127.0.0.1 / metadata IPs are blocked.
 */
export async function assertPublicTarget(domain) {
  const host = String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");

  if (!host || isBlockedHostname(host)) {
    throw new Error(INTERNAL_MESSAGE);
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new Error(INTERNAL_MESSAGE);
    return;
  }

  const resolver = makeResolver();
  const [aResult, aaaaResult] = await Promise.allSettled([
    resolver.resolve4(host),
    resolver.resolve6(host),
  ]);

  const addresses = [
    ...(aResult.status === "fulfilled" ? aResult.value : []),
    ...(aaaaResult.status === "fulfilled" ? aaaaResult.value : []),
  ];

  for (const address of addresses) {
    if (isPrivateIp(address)) {
      throw new Error(INTERNAL_MESSAGE);
    }
  }
}
