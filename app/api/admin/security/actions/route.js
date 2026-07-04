import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const severityPriority = {
  critical: "urgent",
  high: "high",
  medium: "normal",
  low: "low",
  ok: "low"
};

function cleanText(value, fallback = "") {
  return String(value || fallback).trim();
}

function buildFindingMessage({ domain, finding, reportId }) {
  return [
    `Phoenix Scan-funn for ${domain}`,
    reportId ? `Rapport-ID: ${reportId}` : null,
    `Funn: ${finding.title || finding.id || "Ukjent funn"}`,
    `Severity: ${finding.severity || finding.status || "ukjent"}`,
    finding.explain ? `Forklaring: ${finding.explain}` : null,
    finding.fix ? `Anbefalt tiltak: ${finding.fix}` : null,
    finding.effort ? `Estimert arbeid: ${finding.effort}` : null
  ].filter(Boolean).join("\n");
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert. Kan ikke opprette CRM-element fra scan-funn." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const type = cleanText(body.type);
  const domain = cleanText(body.domain);
  const finding = body.finding && typeof body.finding === "object" ? body.finding : null;

  if (!domain || !finding) {
    return NextResponse.json({ error: "Domene og funn er påkrevd." }, { status: 400 });
  }

  const message = buildFindingMessage({ domain, finding, reportId: body.reportId });
  const priority = severityPriority[finding.severity] || severityPriority[finding.status] || "normal";

  if (type === "lead") {
    const payload = {
      name: `Security finding: ${domain}`,
      email: "security-scan@hansen-it.local",
      company: domain,
      message,
      description: message,
      priority: priority === "urgent" || priority === "high" ? "hast" : "normal",
      status: "ny",
      source: "phoenix_scan"
    };

    const { data, error } = await supabaseAdmin.from("requests").insert(payload).select("*").single();
    if (error) {
      console.error("security scan create request error:", error);
      return NextResponse.json({ error: `Kunne ikke opprette lead/request: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, target: "requests", data });
  }

  if (type === "task") {
    const payload = {
      title: cleanText(finding.title, `Security finding: ${domain}`),
      description: message,
      status: "new",
      priority
    };

    const { data, error } = await supabaseAdmin.from("tasks").insert(payload).select("*").single();
    if (error) {
      console.error("security scan create task error:", error);
      return NextResponse.json({ error: `Kunne ikke opprette oppgave: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, target: "tasks", data });
  }

  return NextResponse.json({ error: "Ukjent handling. Bruk type 'lead' eller 'task'." }, { status: 400 });
}
