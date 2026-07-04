import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { checkEmail } from "@/lib/securityScan/checks/email";
import { checkWeb } from "@/lib/securityScan/checks/web";
import { checkTls } from "@/lib/securityScan/checks/tls";
import { checkDnssec, resolveA } from "@/lib/securityScan/checks/dns";
import { checkDomainRegistration } from "@/lib/securityScan/checks/rdap";
import { buildSecurityReport } from "@/lib/securityScan/score";
import { saveSecurityScanReport } from "@/lib/securityScan/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const domainPattern = /^(?!-)[a-z0-9æøå-]{1,63}(\.[a-z0-9æøå-]{1,63})+$/i;

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain);
  if (!domainPattern.test(domain)) {
    return NextResponse.json({ error: "Skriv inn et gyldig domene, for eksempel hansen-it.com." }, { status: 400 });
  }

  const ips = await resolveA(domain);
  const wwwIps = ips.length ? ips : await resolveA(`www.${domain}`);
  if (!ips.length && !wwwIps.length) {
    return NextResponse.json({ error: `Fant ingen DNS-oppføringer for ${domain}.` }, { status: 404 });
  }

  const [web, email, dnssec, rdap] = await Promise.all([
    checkWeb(domain).catch(() => ({ reachable: false, headers: {} })),
    checkEmail(domain).catch(() => ({ hasMx: false, mx: [], spf: { present: false }, dmarc: { present: false }, dkim: { present: false, selectors: [] }, mtaSts: false, tlsRpt: false })),
    checkDnssec(domain).catch(() => ({ enabled: null })),
    checkDomainRegistration(domain).catch(() => ({ found: false }))
  ]);

  const tlsInfo = web.reachable ? await checkTls(web.finalHost || domain).catch(() => ({ ok: false })) : { ok: false };
  const report = buildSecurityReport({ domain, web, tlsInfo, email, dnssec, rdap });
  const saveResult = await saveSecurityScanReport(report, me);

  return NextResponse.json({ ...report, saved: saveResult.saved, reportId: saveResult.id || null, saveError: saveResult.error || null });
}
