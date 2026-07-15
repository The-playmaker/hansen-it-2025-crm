import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function safeList(result, label) {
  if (result?.error) {
    console.error(`customer timeline ${label} error:`, result.error);
    return [];
  }
  return result?.data || [];
}

function truncate(text, max = 80) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function money(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    maximumFractionDigits: 0,
  }).format(number);
}

export async function GET(_request, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ configured: false, data: [] });
  }

  const customerId = String(params?.id || "").trim();
  if (!customerId) {
    return NextResponse.json({ error: "Mangler kunde-ID." }, { status: 400 });
  }

  const [
    scansResult,
    quotesResult,
    invoicesResult,
    documentsResult,
    authorizationsResult,
    requestsResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("security_scan_reports")
      .select("id, domain, score, grade, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("quotes")
      .select("id, title, status, total_inc_vat, created_at, security_report_id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("invoices")
      .select("id, invoice_number, status, total, created_at, quote_id")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("quote_documents")
      .select("id, title, filename, type, created_at, quote_id, is_portal_visible, visible_in_portal")
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("scan_authorizations")
      .select("id, status, created_at, customer_name")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("requests")
      .select("id, message, name, company, status, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
  ]);

  const scans = safeList(scansResult, "scans");
  const quotes = safeList(quotesResult, "quotes");
  const invoices = safeList(invoicesResult, "invoices");
  const documents = safeList(documentsResult, "documents");
  const authorizations = safeList(authorizationsResult, "authorizations");
  const requests = safeList(requestsResult, "requests");

  const scanById = new Map(scans.map((row) => [row.id, row]));
  const quoteById = new Map(quotes.map((row) => [row.id, row]));

  const items = [];

  for (const scan of scans) {
    const scoreLabel =
      scan.score != null ? `${scan.score}/100` : scan.grade ? `Karakter ${scan.grade}` : null;
    items.push({
      type: "scan",
      id: scan.id,
      title: `Sikkerhetsskanning: ${scan.domain || "ukjent domene"}`,
      subtitle: scoreLabel,
      date: scan.created_at,
      status: scoreLabel || "Rapport",
      href: `/admin/security/reports/${scan.id}`,
      relatedTo: null,
    });
  }

  for (const quote of quotes) {
    const total = money(quote.total_inc_vat);
    const scan = quote.security_report_id ? scanById.get(quote.security_report_id) : null;
    items.push({
      type: "quote",
      id: quote.id,
      title: quote.title || "Tilbud",
      subtitle: total,
      date: quote.created_at,
      status: quote.status || "ny",
      href: `/admin/quotes/${quote.id}`,
      relatedTo: scan
        ? {
            type: "scan",
            id: scan.id,
            label: `Scan-rapport ${scan.domain || ""}${scan.score != null ? ` (${scan.score}/100)` : ""}`.trim(),
          }
        : quote.security_report_id
          ? { type: "scan", id: quote.security_report_id, label: "Scan-rapport" }
          : null,
    });
  }

  for (const invoice of invoices) {
    const total = money(invoice.total);
    const quote = invoice.quote_id ? quoteById.get(invoice.quote_id) : null;
    items.push({
      type: "invoice",
      id: invoice.id,
      title: invoice.invoice_number ? `Faktura ${invoice.invoice_number}` : "Faktura",
      subtitle: total,
      date: invoice.created_at,
      status: invoice.status || "kladd",
      href: `/admin/invoices/${invoice.id}`,
      relatedTo: quote
        ? { type: "quote", id: quote.id, label: quote.title || "Tilbud" }
        : invoice.quote_id
          ? { type: "quote", id: invoice.quote_id, label: "Tilbud" }
          : null,
    });
  }

  for (const document of documents) {
    const visible = document.is_portal_visible ?? document.visible_in_portal;
    const quote = document.quote_id ? quoteById.get(document.quote_id) : null;
    items.push({
      type: "document",
      id: document.id,
      title: document.title || document.filename || "Dokument",
      subtitle: document.type || (visible ? "Synlig i portal" : "Skjult i portal"),
      date: document.created_at,
      status: visible ? "synlig" : "skjult",
      href: document.quote_id ? `/admin/quotes/${document.quote_id}` : null,
      relatedTo: quote
        ? { type: "quote", id: quote.id, label: quote.title || "Tilbud" }
        : document.quote_id
          ? { type: "quote", id: document.quote_id, label: "Tilbud" }
          : null,
    });
  }

  for (const authorization of authorizations) {
    items.push({
      type: "authorization",
      id: authorization.id,
      title: "Scan-autorisasjon",
      subtitle: authorization.customer_name || null,
      date: authorization.created_at,
      status: authorization.status || "pending",
      href: `/admin/scan-authorizations/${authorization.id}`,
      relatedTo: null,
    });
  }

  for (const request of requests) {
    items.push({
      type: "request",
      id: request.id,
      title: request.company || request.name || "Forespørsel",
      subtitle: truncate(request.message) || null,
      date: request.created_at,
      status: request.status || "ny",
      href: null,
      relatedTo: null,
    });
  }

  items.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return bTime - aTime;
  });

  return NextResponse.json({ configured: true, data: items });
}
