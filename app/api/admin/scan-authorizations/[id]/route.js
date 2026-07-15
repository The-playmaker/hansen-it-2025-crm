import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: null, message: "Supabase er ikke konfigurert." });
  }

  const { data, error } = await supabaseAdmin
    .from("scan_authorizations")
    .select("*, customer:customers(id,company_name,email), contact:contacts(id,name,email), request:requests(id,name,company,email,status), quote:quotes(id,title,status,total_inc_vat), scan_scopes(*), scan_jobs(*), scan_reports(*)")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  const jobIds = (data.scan_jobs || []).map((job) => job.id);
  const [resultsResponse, findingsResponse, reportsResponse] = jobIds.length ? await Promise.all([
    supabaseAdmin.from("scan_results").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
    supabaseAdmin.from("scan_findings").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
    supabaseAdmin.from("scan_reports").select("*").in("job_id", jobIds).order("created_at", { ascending: false })
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  return NextResponse.json({
    configured: true,
    data: {
      ...data,
      scan_results: resultsResponse.data || [],
      scan_findings: findingsResponse.data || [],
      scan_reports: reportsResponse.data || []
    }
  });
}

export async function PATCH(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "admin")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const allowed = {};
  for (const key of ["status", "terms_text", "expires_at", "signer_name", "signer_email", "signer_role"]) {
    if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("scan_authorizations")
    .update(allowed)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
