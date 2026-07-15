import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { buildReportRecommendation } from "@/lib/securityScan/recommendations";

export const dynamic = "force-dynamic";

function severityOf(item = {}) {
  return item.severity || item.status || "low";
}

const severityWeight = { critical: 0, high: 1, medium: 2, low: 3, info: 4, ok: 5 };

function innerReport(row = {}) {
  return row.report && typeof row.report === "object" ? row.report : row;
}

function dedupeTopActions(actions = []) {
  const grouped = new Map();
  for (const action of actions) {
    const key = String(action.title || action.id || "tiltak").toLowerCase();
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...action, affectedDomains: new Set(action.domain ? [action.domain] : []) });
    } else {
      if ((severityWeight[severityOf(action)] ?? 9) < (severityWeight[severityOf(existing)] ?? 9)) {
        existing.severity = severityOf(action);
      }
      if (action.domain) existing.affectedDomains.add(action.domain);
    }
  }
  return [...grouped.values()]
    .map((action) => ({ ...action, affectedDomains: [...action.affectedDomains] }))
    .sort((a, b) => (severityWeight[severityOf(a)] ?? 9) - (severityWeight[severityOf(b)] ?? 9) || b.affectedDomains.length - a.affectedDomains.length)
    .slice(0, 5);
}

export async function POST(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const { data: authorization, error: authError } = await supabaseAdmin
    .from("scan_authorizations")
    .select("*, scan_jobs(*), scan_results(*), scan_findings(*), scan_reports(*)")
    .eq("id", params.id)
    .maybeSingle();

  if (authError || !authorization) return NextResponse.json({ error: "Fant ikke scan-autorisasjon." }, { status: 404 });

  const domainReports = (authorization.scan_reports || []).filter((row) => (row.report_type || "domain") === "domain").map(innerReport);
  const findings = authorization.scan_findings || [];
  const actions = domainReports.flatMap((report) => (report.actions || []).map((action) => ({ ...action, domain: report.domain })));
  const averageScore = domainReports.length
    ? Math.round(domainReports.reduce((sum, report) => sum + Number(report.score || 0), 0) / domainReports.length)
    : 0;
  const combined = {
    reportType: "combined",
    title: "Phoenix Security Assessment - samlet rapport",
    customerName: authorization.customer_name,
    authorizationId: authorization.id,
    generatedAt: new Date().toISOString(),
    domains: domainReports.map((report) => ({
      domain: report.domain,
      score: report.score,
      grade: report.grade,
      summary: report.summary,
      categories: report.categories,
      actions: report.actions || [],
      findings: report.findings || []
    })),
    score: averageScore,
    findings,
    actions,
    topActions: dedupeTopActions(actions),
    recommendation: buildReportRecommendation({ score: averageScore, findings, actions }),
    sourceJobIds: (authorization.scan_jobs || []).map((job) => job.id)
  };

  const { data, error } = await supabaseAdmin
    .from("scan_reports")
    .insert({
      authorization_id: authorization.id,
      job_id: (authorization.scan_jobs || [])[0]?.id || null,
      title: combined.title,
      report: combined,
      report_type: "combined",
      published_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    console.error("combined scan report create error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
