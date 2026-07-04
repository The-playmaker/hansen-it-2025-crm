import { randomBytes } from "crypto";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

const migrationHint = "Tabellen security_scan_reports mangler i Supabase. Kjør migration supabase/migrations/20260704193000_security_scan_reports.sql i Supabase SQL Editor.";
const sharingMigrationHint = "Tabellene for rapportdeling mangler i Supabase. Kjør migration supabase/migrations/20260704231500_security_scan_report_sharing.sql i Supabase SQL Editor.";

function isMissingTableError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("schema cache") || text.includes("security_scan_reports");
}

function friendlyError(error, hint = migrationHint) {
  return isMissingTableError(error) ? hint : error?.message || "Ukjent databasefeil.";
}

export async function saveSecurityScanReport(report, user = null) {
  if (!hasSupabaseAdminConfig) {
    return { saved: false, reason: "not_configured", error: "Supabase er ikke konfigurert, så rapporten ble ikke lagret." };
  }

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
    return { saved: false, error: friendlyError(error), needsMigration: isMissingTableError(error) };
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
    return { configured: true, data: [], error: friendlyError(error), needsMigration: isMissingTableError(error) };
  }

  return { configured: true, data: data || [] };
}

export async function getSecurityScanReport(id) {
  if (!hasSupabaseAdminConfig) return { configured: false, data: null, error: "Supabase er ikke konfigurert." };

  const { data, error } = await supabaseAdmin
    .from("security_scan_reports")
    .select("id,domain,score,grade,created_at,created_by,report")
    .eq("id", id)
    .single();

  if (error) return { configured: true, data: null, error: friendlyError(error) };
  return { configured: true, data };
}

export async function getOrCreateSecurityScanShare(reportId, user = null) {
  if (!hasSupabaseAdminConfig) return { configured: false, error: "Supabase er ikke konfigurert." };

  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("security_scan_report_shares")
    .select("*")
    .eq("report_id", reportId)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError && !isMissingTableError(existingError)) return { configured: true, error: existingError.message };
  if (existing) return { configured: true, data: existing, reused: true };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from("security_scan_report_shares")
    .insert({
      report_id: reportId,
      token: randomBytes(32).toString("hex"),
      expires_at: expiresAt.toISOString(),
      created_by: user?.email || user?.name || null
    })
    .select("*")
    .single();

  if (error) return { configured: true, error: friendlyError(error, sharingMigrationHint), needsMigration: isMissingTableError(error) };
  return { configured: true, data, reused: false };
}

export async function getSecurityScanReportByToken(token) {
  if (!hasSupabaseAdminConfig) return { configured: false, error: "Supabase er ikke konfigurert." };

  const { data, error } = await supabaseAdmin
    .from("security_scan_report_shares")
    .select("*, report:security_scan_reports(id,domain,score,grade,created_at,created_by,report)")
    .eq("token", token)
    .single();

  if (error || !data) return { configured: true, error: "Ugyldig rapportlenke." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { configured: true, error: "Rapportlenken er utløpt.", expired: true };

  await supabaseAdmin
    .from("security_scan_report_shares")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id);

  return { configured: true, data };
}

export async function logSecurityScanDelivery(payload) {
  if (!hasSupabaseAdminConfig) return { configured: false, error: "Supabase er ikke konfigurert." };

  const { data, error } = await supabaseAdmin
    .from("security_scan_report_deliveries")
    .insert(payload)
    .select("*")
    .single();

  if (error) return { configured: true, error: friendlyError(error, sharingMigrationHint), needsMigration: isMissingTableError(error) };
  return { configured: true, data };
}
