import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const { data: authorization, error } = await supabaseAdmin
    .from("scan_authorizations")
    .select("*, scan_scopes(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (error || !authorization) return NextResponse.json({ error: "Fant ikke scan-autorisasjon." }, { status: 404 });
  if (authorization.status !== "signed") return NextResponse.json({ error: "Ny scan krever signert autorisasjon." }, { status: 409 });

  const scope = authorization.scan_scopes?.[0];
  if (!scope) return NextResponse.json({ error: "Mangler scope." }, { status: 400 });

  const domains = scope.domains || [];
  if (!domains.length) return NextResponse.json({ error: "Passiv scan krever minst ett domene." }, { status: 400 });

  const { data: job, error: jobError } = await supabaseAdmin
    .from("scan_jobs")
    .insert({
      authorization_id: authorization.id,
      scope_id: scope.id,
      status: "queued",
      scan_type: "passive",
      domains,
      ip_addresses: scope.ip_addresses || [],
      requested_by_name: authorization.signer_name,
      requested_by_email: authorization.signer_email,
      requested_by_role: authorization.signer_role,
      requested_ip: authorization.signed_ip,
      metadata: {
        created_from_admin: true,
        created_by: me.email || me.name || "phoenix",
        reason: "manual passive rescan"
      }
    })
    .select("*")
    .single();

  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  return NextResponse.json({ data: job }, { status: 201 });
}
