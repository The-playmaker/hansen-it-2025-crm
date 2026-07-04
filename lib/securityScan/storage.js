import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export async function saveSecurityScanReport(report, user = null) {
  if (!hasSupabaseAdminConfig) return { saved: false, reason: "not_configured" };

  const { data, error } = await supabaseAdmin
    .from("security_scan_reports")
    .insert({
      domain: report.domain,
      score: report.score,
      grade: report.grade,
      report,
      created_by: user?.email || user?.name || null
    })
    .select("id")
    .single();

  if (error) {
    console.error("security_scan_reports insert error:", error);
    return { saved: false, error: error.message };
  }

  return { saved: true, id: data?.id || null };
}

export async function listSecurityScanReports() {
  if (!hasSupabaseAdminConfig) return { configured: false, data: [] };

  const { data, error } = await supabaseAdmin
    .from("security_scan_reports")
    .select("id,domain,score,grade,created_at,created_by,report")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("security_scan_reports read error:", error);
    return { configured: true, data: [], error: error.message };
  }

  return { configured: true, data: data || [] };
}
