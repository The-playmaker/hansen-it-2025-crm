import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { checkEmail } from "@/lib/securityScan/checks/email";
import { checkWeb } from "@/lib/securityScan/checks/web";
import { checkTls } from "@/lib/securityScan/checks/tls";
import { checkDnssec, discoverSubdomains } from "@/lib/securityScan/checks/dns";
import { checkDomainRegistration } from "@/lib/securityScan/checks/rdap";
import {
  checkExposedBackend,
  isActiveScanAllowed,
  skippedExposedBackend,
} from "@/lib/securityScan/checks/exposedBackend";
import { assertPublicTarget } from "@/lib/securityScan/guards";
import { buildSecurityReport } from "@/lib/securityScan/score";
import { saveSecurityScanReport } from "@/lib/securityScan/storage";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { assessDomainDns } from "@/lib/scanAuthorizationValidation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const domainPattern = /^(?!-)[a-z0-9æøå-]{1,63}(\.[a-z0-9æøå-]{1,63})+$/i;

function normalizeDomain(input) {
  return String(input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].split(":")[0];
}

function cleanId(value) {
  return value ? String(value).trim() : null;
}

/**
 * Exposed-backend check requires a signed scan authorization that includes the domain.
 */
async function hasSignedAuthorizationForDomain(domain, authorizationId = null) {
  if (!hasSupabaseAdminConfig) return false;

  if (authorizationId) {
    const { data, error } = await supabaseAdmin
      .from("scan_authorizations")
      .select("id, status, scan_scopes(domains)")
      .eq("id", authorizationId)
      .maybeSingle();
    if (error || !data || data.status !== "signed") return false;
    const scopes = Array.isArray(data.scan_scopes) ? data.scan_scopes : data.scan_scopes ? [data.scan_scopes] : [];
    return scopes.some((scope) =>
      (scope.domains || []).map(normalizeDomain).includes(domain)
    );
  }

  const { data, error } = await supabaseAdmin
    .from("scan_scopes")
    .select("id, domains, authorization:scan_authorizations!inner(id, status)")
    .eq("scan_authorizations.status", "signed")
    .contains("domains", [domain])
    .limit(1)
    .maybeSingle();

  if (error || !data) return false;
  return data.authorization?.status === "signed";
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

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

  try {
    await assertPublicTarget(domain);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Kan ikke skanne interne adresser." },
      { status: 400 }
    );
  }

  const dnsPresence = await assessDomainDns(domain);
  if (dnsPresence.empty) {
    const payload = {
      error: `Vi fant ingen DNS-oppføringer for ${domain}. Domenet ser ikke ut til å være i bruk.`,
    };
    if (dnsPresence.suggestion) {
      payload.suggestion = dnsPresence.suggestion;
      payload.hint = `Mente du ${dnsPresence.suggestion}?`;
    }
    return NextResponse.json(payload, { status: 422 });
  }

  const [web, email, dnssec, rdap, subdomains] = await Promise.all([
    checkWeb(domain).catch(() => ({ reachable: false, headers: {} })),
    checkEmail(domain).catch(() => ({ hasMx: false, mx: [], spf: { present: false }, dmarc: { present: false }, dkim: { present: false, selectors: [] }, mtaSts: false, tlsRpt: false })),
    checkDnssec(domain).catch(() => ({ enabled: null })),
    checkDomainRegistration(domain).catch(() => ({ found: false })),
    discoverSubdomains(domain).catch(() => [])
  ]);

  const tlsInfo = web.reachable ? await checkTls(web.finalHost || domain).catch(() => ({ ok: false })) : { ok: false };

  let exposedBackend = skippedExposedBackend("not_authorized");
  const authorizationId = cleanId(body.authorization_id);
  const signed = await hasSignedAuthorizationForDomain(domain, authorizationId).catch(() => false);
  if (signed && isActiveScanAllowed()) {
    exposedBackend = await checkExposedBackend(domain).catch(() =>
      skippedExposedBackend("check_failed")
    );
  } else if (signed && !isActiveScanAllowed()) {
    exposedBackend = skippedExposedBackend("active_scan_disabled");
  }

  const report = buildSecurityReport({
    domain,
    web,
    tlsInfo,
    email,
    dnssec,
    rdap,
    subdomains,
    exposedBackend,
    dnsPresence,
  });
  const links = {
    customer_id: cleanId(body.customer_id),
    request_id: cleanId(body.request_id),
    lead_id: cleanId(body.lead_id)
  };
  const saveResult = await saveSecurityScanReport(report, me, links);

  return NextResponse.json({
    ...report,
    ...links,
    saved: saveResult.saved,
    reportId: saveResult.id || null,
    saveError: saveResult.error || null,
    exposedBackendRan: Boolean(exposedBackend?.ran),
  });
}
