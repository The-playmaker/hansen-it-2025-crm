import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const severityPriority = {
  critical: "urgent",
  high: "high",
  medium: "normal",
  low: "low",
  ok: "low"
};

const quotePriceBySeverity = {
  critical: 12500,
  high: 8500,
  medium: 4500,
  low: 2500,
  ok: 0
};

function cleanText(value, fallback = "") {
  return String(value || fallback).trim();
}

function cleanId(value) {
  return value ? String(value).trim() : null;
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

function relationPayload(body = {}) {
  return {
    customer_id: cleanId(body.customer_id),
    request_id: cleanId(body.request_id),
    lead_id: cleanId(body.lead_id),
    security_report_id: cleanId(body.reportId || body.security_report_id),
    security_finding_id: cleanText(body.finding?.id)
  };
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

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

  const links = relationPayload(body);
  const message = buildFindingMessage({ domain, finding, reportId: links.security_report_id });
  const priority = severityPriority[finding.severity] || severityPriority[finding.status] || "normal";
  const priorityForRequest = priority === "urgent" || priority === "high" ? "hast" : "normal";

  if (type === "lead") {
    const payload = {
      name: `Security finding: ${domain}`,
      email: "security-scan@hansen-it.local",
      company: domain,
      message,
      description: message,
      priority: priorityForRequest,
      status: "ny",
      source: "phoenix_scan",
      customer_id: links.customer_id,
      lead_id: links.lead_id
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
      priority,
      customer_id: links.customer_id,
      request_id: links.request_id,
      security_report_id: links.security_report_id,
      security_finding_id: links.security_finding_id
    };

    const { data, error } = await supabaseAdmin.from("tasks").insert(payload).select("*").single();
    if (error) {
      console.error("security scan create task error:", error);
      return NextResponse.json({ error: `Kunne ikke opprette oppgave: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, target: "tasks", data });
  }

  if (type === "quote") {
    const unitPrice = quotePriceBySeverity[finding.severity] ?? quotePriceBySeverity[finding.status] ?? 4500;
    const quotePayload = {
      customer_id: links.customer_id,
      lead_id: links.lead_id,
      source_request_id: links.request_id,
      security_report_id: links.security_report_id,
      security_finding_id: links.security_finding_id,
      title: `Fix with Hansen IT: ${cleanText(finding.title, domain)}`,
      description: message,
      status: "kladd",
      total_ex_vat: unitPrice,
      total_vat: Math.round(unitPrice * 0.25),
      total_inc_vat: Math.round(unitPrice * 1.25),
      internal_notes: `Opprettet fra Phoenix Scan av ${domain}.`,
      customer_note: finding.fix || finding.explain || null
    };

    const { data: quote, error: quoteError } = await supabaseAdmin.from("quotes").insert(quotePayload).select("*").single();
    if (quoteError) {
      console.error("security scan create quote error:", quoteError);
      return NextResponse.json({ error: `Kunne ikke opprette tilbudskladd: ${quoteError.message}` }, { status: 500 });
    }

    await supabaseAdmin.from("quote_items").insert({
      quote_id: quote.id,
      description: finding.fix || finding.title || `Sikkerhetstiltak for ${domain}`,
      quantity: 1,
      unit_price: unitPrice,
      discount: 0,
      vat_rate: 25,
      line_total_ex_vat: unitPrice
    });

    return NextResponse.json({ ok: true, target: "quotes", data: quote });
  }

  if (type === "note") {
    if (!links.customer_id) {
      return NextResponse.json({ error: "Kunde må være koblet for å legge til kundenotat." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from("activity_log").insert({
      customer_id: links.customer_id,
      request_id: links.request_id,
      activity_type: "security_finding",
      title: cleanText(finding.title, `Security finding: ${domain}`),
      description: message,
      metadata: {
        domain,
        reportId: links.security_report_id,
        findingId: links.security_finding_id,
        severity: finding.severity || finding.status || null,
        fix: finding.fix || null,
        createdBy: me.email || me.name || null
      }
    }).select("*").single();

    if (error) {
      console.error("security scan create activity error:", error);
      return NextResponse.json({ error: `Kunne ikke legge til kundenotat: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, target: "activity_log", data });
  }

  return NextResponse.json({ error: "Ukjent handling. Bruk type 'lead', 'task', 'quote' eller 'note'." }, { status: 400 });
}
