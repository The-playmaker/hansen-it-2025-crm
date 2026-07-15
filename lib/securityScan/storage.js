import { randomBytes } from "crypto";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const migrationHint = "Tabellen security_scan_reports mangler eller mangler CRM-linkfelter i Supabase. Kjør migration supabase/migrations/20260705093000_security_scan_report_crm_links.sql i Supabase SQL Editor.";
const sharingMigrationHint = "Tabellene for rapportdeling mangler i Supabase. Kjør migration supabase/migrations/20260704231500_security_scan_report_sharing.sql i Supabase SQL Editor.";

function isMissingTableError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("schema cache") || text.includes("security_scan_reports");
}

function friendlyError(error, hint = migrationHint) {
  return isMissingTableError(error) ? hint : error?.message || "Ukjent databasefeil.";
}

function cleanId(value) {
  return value ? String(value).trim() : null;
}

function reportSelect() {
  return "id,domain,score,grade,created_at,created_by,customer_id,request_id,lead_id,report";
}

function normalizeScanReportRow(row = {}) {
  const report = row.report && typeof row.report === "object" ? row.report : {};
  return {
    ...row,
    source_table: "scan_reports",
    domain: row.domain || report.domain || report.domains?.[0] || null,
    score: row.score ?? report.score ?? null,
    grade: row.grade || report.grade || null,
    customer_id: row.customer_id || null,
    request_id: row.request_id || null,
    lead_id: row.lead_id || null,
    quote_id: row.quote_id || null,
    authorization_id: row.authorization_id || null,
    title: row.title || report.title || "Phoenix Security Report",
    report
  };
}

async function attachReportRelations(reports = []) {
  if (!reports.length) return reports;

  const customerIds = [...new Set(reports.map((report) => report.customer_id).filter(Boolean))];
  const requestIds = [...new Set(reports.map((report) => report.request_id).filter(Boolean))];
  const leadIds = [...new Set(reports.map((report) => report.lead_id).filter(Boolean))];

  const [customersResult, requestsResult, leadsResult] = await Promise.all([
    customerIds.length ? supabaseAdmin.from("customers").select("id,company_name,email,website").in("id", customerIds) : Promise.resolve({ data: [] }),
    requestIds.length ? supabaseAdmin.from("requests").select("id,name,email,company,status,priority").in("id", requestIds) : Promise.resolve({ data: [] }),
    leadIds.length ? supabaseAdmin.from("leads").select("id,title,status,customer_id,contact_id").in("id", leadIds) : Promise.resolve({ data: [] })
  ]);

  const customers = new Map((customersResult.data || []).map((customer) => [customer.id, customer]));
  const requests = new Map((requestsResult.data || []).map((request) => [request.id, request]));
  const leads = new Map((leadsResult.data || []).map((lead) => [lead.id, lead]));

  return reports.map((report) => ({
    ...report,
    customer: report.customer_id ? customers.get(report.customer_id) || null : null,
    request: report.request_id ? requests.get(report.request_id) || null : null,
    lead: report.lead_id ? leads.get(report.lead_id) || null : null
  }));
}

export async function saveSecurityScanReport(report, user = null, links = {}) {
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
      customer_id: cleanId(links.customer_id),
      request_id: cleanId(links.request_id),
      lead_id: cleanId(links.lead_id),
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
    .select(reportSelect())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("security_scan_reports read error:", error);
    return { configured: true, data: [], error: friendlyError(error), needsMigration: isMissingTableError(error) };
  }

  return { configured: true, data: await attachReportRelations(data || []) };
}

export async function getSecurityScanReport(id) {
  if (!hasSupabaseAdminConfig) return { configured: false, data: null, error: "Supabase er ikke konfigurert." };

  const { data, error } = await supabaseAdmin
    .from("security_scan_reports")
    .select(reportSelect())
    .eq("id", id)
    .single();

  if (!error && data) {
    const [withRelations] = await attachReportRelations([{ ...data, source_table: "security_scan_reports" }]);
    return { configured: true, data: withRelations || data };
  }

  const scanResult = await supabaseAdmin
    .from("scan_reports")
    .select("*, authorization:scan_authorizations(*), job:scan_jobs(*)")
    .eq("id", id)
    .maybeSingle();

  if (scanResult.error) {
    console.error("scan_reports fallback read error:", scanResult.error);
    return { configured: true, data: null, error: friendlyError(error || scanResult.error) };
  }

  if (!scanResult.data) return { configured: true, data: null, error: friendlyError(error) };

  const normalized = normalizeScanReportRow({
    ...scanResult.data,
    customer_id: scanResult.data.customer_id || scanResult.data.authorization?.customer_id || null,
    request_id: scanResult.data.request_id || scanResult.data.authorization?.request_id || null,
    lead_id: scanResult.data.lead_id || scanResult.data.authorization?.lead_id || null,
    quote_id: scanResult.data.quote_id || scanResult.data.authorization?.quote_id || null
  });
  const [withRelations] = await attachReportRelations([normalized]);
  return { configured: true, data: withRelations || normalized };
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
    .select(`*, report:security_scan_reports(${reportSelect()})`)
    .eq("token", token)
    .single();

  if (error || !data) return { configured: true, error: "Ugyldig rapportlenke." };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { configured: true, error: "Rapportlenken er utløpt.", expired: true };

  await supabaseAdmin
    .from("security_scan_report_shares")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("id", data.id);

  const [report] = await attachReportRelations(data.report ? [data.report] : []);
  return { configured: true, data: { ...data, report: report || data.report } };
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
