import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
}

function getIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

async function loadAuthorization(token) {
  return supabaseAdmin
    .from("scan_authorizations")
    .select("*, scan_scopes(*), scan_jobs(*)")
    .eq("token", token)
    .single();
}

export async function GET(_request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Scan-autorisasjon er ikke konfigurert." }, { status: 503 });
  }

  const { data, error } = await loadAuthorization(params.token);
  if (error || !data) return NextResponse.json({ error: "Ugyldig eller utløpt lenke." }, { status: 404 });

  return NextResponse.json({ data });
}

export async function POST(request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Scan-autorisasjon er ikke konfigurert." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { data: authorization, error } = await loadAuthorization(params.token);
  if (error || !authorization) return NextResponse.json({ error: "Ugyldig eller utløpt lenke." }, { status: 404 });

  if (authorization.status !== "pending") {
    return NextResponse.json({ error: "Denne autorisasjonen kan ikke signeres nå." }, { status: 409 });
  }

  if (authorization.expires_at && new Date(authorization.expires_at) < new Date()) {
    await supabaseAdmin.from("scan_authorizations").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", authorization.id);
    return NextResponse.json({ error: "Autorisasjonslenken er utløpt." }, { status: 410 });
  }

  const signerName = String(body.signer_name || authorization.signer_name || "").trim();
  const signerEmail = String(body.signer_email || authorization.signer_email || "").trim();
  const signerRole = String(body.signer_role || authorization.signer_role || "").trim();
  const accepted = Boolean(body.accepted_terms);

  if (!signerName || !signerEmail || !signerRole || !accepted) {
    return NextResponse.json({ error: "Navn, e-post, rolle og godkjenning av vilkår er påkrevd." }, { status: 400 });
  }

  const scope = authorization.scan_scopes?.[0];
  if (!scope) return NextResponse.json({ error: "Mangler scan-scope." }, { status: 400 });

  const domains = list(body.domains).length ? list(body.domains) : scope.domains || [];
  const ipAddresses = list(body.ip_addresses).length ? list(body.ip_addresses) : scope.ip_addresses || [];
  const scanType = body.scan_type || scope.scan_type || "passive";

  if (!domains.length && !ipAddresses.length) {
    return NextResponse.json({ error: "Minst ett domene eller én IP må være med i scope." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ip = getIp(request);
  const signatureData = {
    method: "typed-name",
    accepted_terms: true,
    terms_version: authorization.terms_version,
    signer_name: signerName,
    signer_email: signerEmail,
    signer_role: signerRole,
    signed_ip: ip,
    signed_at: now,
    scope: { domains, ip_addresses: ipAddresses, scan_type: scanType },
    user_agent: request.headers.get("user-agent") || null
  };

  const { data: updatedScope, error: scopeError } = await supabaseAdmin
    .from("scan_scopes")
    .update({
      domains,
      ip_addresses: ipAddresses,
      scan_type: scanType,
      confirmed_by_customer: true,
      confirmed_at: now,
      updated_at: now
    })
    .eq("id", scope.id)
    .select("*")
    .single();

  if (scopeError) return NextResponse.json({ error: scopeError.message }, { status: 500 });

  const { data: signedAuthorization, error: authError } = await supabaseAdmin
    .from("scan_authorizations")
    .update({
      status: "signed",
      signer_name: signerName,
      signer_email: signerEmail,
      signer_role: signerRole,
      signed_at: now,
      signed_ip: ip,
      signature_data: signatureData,
      updated_at: now
    })
    .eq("id", authorization.id)
    .eq("status", "pending")
    .select("*")
    .single();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from("scan_jobs")
    .insert({
      authorization_id: signedAuthorization.id,
      scope_id: updatedScope.id,
      status: "queued",
      scan_type: scanType,
      domains,
      ip_addresses: ipAddresses,
      requested_by_name: signerName,
      requested_by_email: signerEmail,
      requested_by_role: signerRole,
      requested_ip: ip,
      metadata: { signature_data: signatureData }
    })
    .select("*")
    .single();

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });

  return NextResponse.json({ data: { authorization: signedAuthorization, scope: updatedScope, job } });
}
