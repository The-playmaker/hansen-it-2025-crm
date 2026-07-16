import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DETAIL_SELECT =
  "*, customer:customers(id,company_name,email), contact:contacts(id,name,email), request:requests(id,name,company,email,status), lead:leads(id,title,status), quote:quotes(id,title,status,total_inc_vat), scan_scopes(*), scan_jobs(*), scan_reports(*)";

const LINK_KEYS = ["customer_id", "request_id", "lead_id", "contact_id", "quote_id"];
const META_KEYS = ["status", "terms_text", "expires_at", "signer_name", "signer_email", "signer_role", "customer_name"];

function cleanId(value) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  const text = String(value).trim();
  return text || null;
}

async function loadAuthorization(id) {
  const { data, error } = await supabaseAdmin
    .from("scan_authorizations")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .single();

  if (error) return { error };
  const jobIds = (data.scan_jobs || []).map((job) => job.id);
  const [resultsResponse, findingsResponse, reportsResponse] = jobIds.length
    ? await Promise.all([
        supabaseAdmin.from("scan_results").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
        supabaseAdmin.from("scan_findings").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
        supabaseAdmin.from("scan_reports").select("*").in("job_id", jobIds).order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return {
    data: {
      ...data,
      scan_results: resultsResponse.data || [],
      scan_findings: findingsResponse.data || [],
      scan_reports: reportsResponse.data || [],
    },
  };
}

export async function GET(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: null, message: "Supabase er ikke konfigurert." });
  }

  const result = await loadAuthorization(params.id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 404 });
  return NextResponse.json({ configured: true, data: result.data });
}

export async function PATCH(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
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
  for (const key of META_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = body[key];
  }
  for (const key of LINK_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) allowed[key] = cleanId(body[key]);
  }
  allowed.updated_at = new Date().toISOString();

  if (Object.keys(allowed).length <= 1) {
    return NextResponse.json({ error: "Ingen gyldige felter å oppdatere." }, { status: 400 });
  }

  const { data: updated, error } = await supabaseAdmin
    .from("scan_authorizations")
    .update(allowed)
    .eq("id", params.id)
    .select("id")
    .single();

  if (error) {
    console.error("scan_authorizations PATCH failed:", error);
    return NextResponse.json({ error: error.message || "Kunne ikke oppdatere autorisasjonen." }, { status: 500 });
  }

  // Speil CRM-koblinger over på tilhørende scan_reports
  const reportPatch = {};
  for (const key of LINK_KEYS) {
    if (Object.prototype.hasOwnProperty.call(allowed, key)) reportPatch[key] = allowed[key];
  }
  if (Object.keys(reportPatch).length) {
    const { error: reportError } = await supabaseAdmin
      .from("scan_reports")
      .update(reportPatch)
      .eq("authorization_id", params.id);
    if (reportError) console.error("scan_reports link sync failed:", reportError);
  }

  const result = await loadAuthorization(updated.id);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ data: result.data });
}
