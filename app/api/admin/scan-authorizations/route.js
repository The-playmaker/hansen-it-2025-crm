import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseDomainList, validateScanDomains } from "@/lib/scanAuthorizationValidation";

export const dynamic = "force-dynamic";

const defaultTerms = `Jeg bekrefter at Hansen IT har tillatelse til å gjennomføre den definerte Phoenix Scan-sjekken på oppgitt scope. Skanningen skal begrenses til scope, scan-type og vilkår som er godkjent her. Aktiv testing skal ikke utføres uten gyldig signert autorisasjon.`;

function list(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(/[\n,;]/).map((item) => item.trim()).filter(Boolean);
}

export async function GET() {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [], message: "Supabase er ikke konfigurert." });
  }

  const { data, error } = await supabaseAdmin
    .from("scan_authorizations")
    .select("*, customer:customers(id,company_name,email), contact:contacts(id,name,email), request:requests(id,name,company,email,status), quote:quotes(id,title,status,total_inc_vat), scan_scopes(*), scan_jobs(*)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ configured: true, data: data || [] });
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const customerName = String(body.customer_name || "").trim();
  const signerEmail = String(body.signer_email || "").trim();
  if (!customerName || !signerEmail) {
    return NextResponse.json({ error: "Kundenavn og e-post er påkrevd." }, { status: 400 });
  }

  const domains = parseDomainList(body.domains);
  const preflight = await validateScanDomains(domains);
  if (preflight.invalid.length) {
    return NextResponse.json({ error: "Ett eller flere domener har ugyldig format.", preflight }, { status: 400 });
  }
  if (preflight.requiresOverride && !body.confirm_dns_warnings) {
    return NextResponse.json({ error: "Fant domener uten DNS records. Bekreft overstyring hvis scope likevel er riktig.", preflight, requiresOverride: true }, { status: 409 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + Number(body.expires_in_days || 14));

  const authorizationPayload = {
    token: randomBytes(32).toString("hex"),
    customer_id: String(body.customer_id || "").trim() || null,
    contact_id: String(body.contact_id || "").trim() || null,
    request_id: String(body.request_id || "").trim() || null,
    quote_id: String(body.quote_id || "").trim() || null,
    lead_id: String(body.lead_id || "").trim() || null,
    customer_name: customerName,
    signer_name: String(body.signer_name || "").trim() || null,
    signer_email: signerEmail,
    signer_role: String(body.signer_role || "").trim() || null,
    status: "pending",
    terms_text: String(body.terms_text || defaultTerms).trim(),
    created_by: me.email || me.name || "phoenix",
    expires_at: expiresAt.toISOString()
  };

  const { data: authorization, error: authError } = await supabaseAdmin
    .from("scan_authorizations")
    .insert(authorizationPayload)
    .select("*")
    .single();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  const scopePayload = {
    authorization_id: authorization.id,
    scan_type: body.scan_type || "passive",
    domains,
    ip_addresses: list(body.ip_addresses),
    allowed_checks: body.allowed_checks || ["dns", "http", "tls", "email", "subdomains"],
    exclusions: String(body.exclusions || "").trim() || null,
    notes: [
      String(body.notes || "").trim(),
      preflight.warnings.length ? `Preflight warnings: ${preflight.warnings.map((item) => `${item.domain}: ${item.warnings.join(" | ")}`).join("; ")}` : ""
    ].filter(Boolean).join("\n") || null
  };

  const { data: scope, error: scopeError } = await supabaseAdmin
    .from("scan_scopes")
    .insert(scopePayload)
    .select("*")
    .single();

  if (scopeError) return NextResponse.json({ error: scopeError.message }, { status: 500 });

  return NextResponse.json({ data: { ...authorization, scan_scopes: [scope] } }, { status: 201 });
}
