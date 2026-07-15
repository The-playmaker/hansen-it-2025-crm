import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { ensureQuoteDocumentFromAttachment } from "@/lib/quoteDocuments";
import { ensureQuotePortalToken } from "@/lib/portal/quotePortalTokens";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

export const dynamic = "force-dynamic";

function ok(key, label, details = "") {
  return { key, label, ok: true, details };
}

function fail(key, label, details = "") {
  return { key, label, ok: false, details };
}

async function storageReady(document) {
  if (document.external_url) return true;
  if (!document.storage_path) return false;
  const { data, error } = await supabaseAdmin.storage
    .from("quote-attachments")
    .createSignedUrl(document.storage_path, 60);
  return Boolean(data?.signedUrl && !error);
}

async function loadQuoteItems(quote) {
  const ids = [quote.id, quote.source_request_id].filter(Boolean);
  const filter = ids.flatMap((id) => [`quote_id.eq.${id}`, `request_id.eq.${id}`]).join(",");
  const { data, error } = await supabaseAdmin
    .from("quote_items")
    .select("*")
    .or(filter);
  if (error) throw error;
  return data || [];
}

async function normalizeQuoteItems(quote) {
  const items = await loadQuoteItems(quote);
  const packageIds = [...new Set(items.map((item) => item.service_package_id).filter(Boolean))];
  let packages = [];
  if (packageIds.length) {
    const packageResult = await supabaseAdmin
      .from("service_packages")
      .select("id, name, short_description")
      .in("id", packageIds);
    packages = packageResult.data || [];
  }
  const packageMap = new Map(packages.map((pkg) => [String(pkg.id), pkg]));

  for (const item of items) {
    const pkg = item.service_package_id ? packageMap.get(String(item.service_package_id)) : null;
    const quantity = Number(item.quantity || 1);
    const unitPrice = Number(item.unit_price || 0);
    const discount = Number(item.discount || 0);
    const vatRate = Number(item.vat_rate ?? 25);
    const lineTotalExVat = Math.max(0, Math.round(quantity * unitPrice - discount));
    const lineTotal = Math.round(lineTotalExVat * (1 + vatRate / 100));
    const patch = {
      item_type: item.service_package_id ? "package" : item.item_type || "custom",
      title: item.title || pkg?.name || item.description || "Tilbudslinje",
      description: item.description || pkg?.short_description || null,
      line_total_ex_vat: lineTotalExVat,
      line_total: lineTotal,
    };

    await supabaseAdmin
      .from("quote_items")
      .update(patch)
      .eq("id", item.id);
  }

  const normalized = await loadQuoteItems(quote);
  const subtotal = normalized.reduce((sum, item) => sum + Number(item.line_total_ex_vat || 0), 0);
  const vat = normalized.reduce((sum, item) => {
    const exVat = Number(item.line_total_ex_vat || 0);
    const vatRate = Number(item.vat_rate ?? 25);
    return sum + Math.round(exVat * (vatRate / 100));
  }, 0);
  const total = subtotal + vat;

  const { data: updatedQuote } = await supabaseAdmin
    .from("quotes")
    .update({ total_ex_vat: subtotal, total_vat: vat, total_inc_vat: total, updated_at: new Date().toISOString() })
    .eq("id", quote.id)
    .select("*")
    .maybeSingle();

  return { items: normalized, subtotal, vat, total, quote: updatedQuote || quote };
}

async function connectLegacyAttachments(quote) {
  const ids = [quote.id, quote.source_request_id].filter(Boolean);
  const { data: attachments, error } = await supabaseAdmin
    .from("quote_attachments")
    .select("*")
    .in("quote_id", ids);

  if (error) throw error;

  const connected = [];
  for (const attachment of attachments || []) {
    const result = await ensureQuoteDocumentFromAttachment({
      attachmentId: attachment.id,
      quoteId: quote.id,
      requestId: quote.source_request_id || (String(attachment.quote_id) !== String(quote.id) ? attachment.quote_id : null),
      customerId: quote.customer_id || null,
      isPortalVisible: true,
    });
    if (result.error) throw result.error;
    if (result.data) connected.push(result.data);
  }
  return connected;
}

async function loadVisibleDocuments(quoteId) {
  const { data, error } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("quote_id", quoteId)
    .eq("is_portal_visible", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const checks = [];
  let portalToken = null;
  let quoteItems = [];
  let totals = { subtotal: 0, vat: 0, total: 0 };
  let documents = [];

  try {
    const tokenResult = await ensureQuotePortalToken(quote.id);
    portalToken = tokenResult.data;
    checks.push(ok("portal_token", "Portal-token", tokenResult.reused ? "Eksisterende token brukes." : "Ny token opprettet."));
  } catch (error) {
    console.error("prepare portal token failed:", { inputId: params.id, quoteId: quote.id, error });
    checks.push(fail("portal_token", "Portal-token", error.message || "Kunne ikke opprette portal-token."));
  }

  try {
    const normalized = await normalizeQuoteItems(quote);
    quoteItems = normalized.items;
    totals = { subtotal: normalized.subtotal, vat: normalized.vat, total: normalized.total };
    quote = normalized.quote;
    checks.push(quoteItems.length
      ? ok("quote_items", "Tilbudslinjer", `${quoteItems.length} linjer funnet.`)
      : fail("quote_items", "Tilbudslinjer", "Ingen produktpakker eller tilbudslinjer funnet."));
    checks.push(totals.total > 0
      ? ok("quote_total", "Tilbudssum", `${totals.subtotal.toLocaleString("nb-NO")} kr eks. mva / ${totals.total.toLocaleString("nb-NO")} kr inkl. mva.`)
      : fail("quote_total", "Tilbudssum", "Tilbudet mangler total."));
  } catch (error) {
    console.error("prepare portal quote items failed:", { inputId: params.id, quoteId: quote.id, error });
    checks.push(fail("quote_items", "Tilbudslinjer", error.message || "Kunne ikke hente tilbudslinjer."));
    checks.push(fail("quote_total", "Tilbudssum", "Kunne ikke beregne total."));
  }

  try {
    await connectLegacyAttachments(quote);
    documents = await loadVisibleDocuments(quote.id);
    checks.push(ok("documents_visible", "Synlige dokumenter", `${documents.length} dokumenter synlige i portal.`));
  } catch (error) {
    console.error("prepare portal documents failed:", { inputId: params.id, quoteId: quote.id, error });
    checks.push(fail("documents_visible", "Synlige dokumenter", error.message || "Kunne ikke koble dokumenter."));
  }

  const quotePdf = documents.find((document) => document.type === "quote_pdf" || /offer|quote|tilbud/i.test(document.filename || ""));
  const scanPdf = documents.find((document) => /scan|security|sikkerhet/i.test(`${document.type || ""} ${document.filename || ""}`));

  checks.push(quotePdf ? ok("quote_pdf", "Tilbud PDF", quotePdf.filename) : fail("quote_pdf", "Tilbud PDF", "Tilbud PDF mangler."));
  const hasLinkedScanReport = Boolean(quote.security_report_id || quote.scan_report_id);
  checks.push(scanPdf || !hasLinkedScanReport
    ? ok("scan_pdf", "Sikkerhetsrapport", scanPdf?.filename || "Ingen sikkerhetsrapport koblet til tilbudet.")
    : fail("scan_pdf", "Sikkerhetsrapport", "Sikkerhetsrapport mangler."));

  try {
    const testedDocuments = [quotePdf, scanPdf].filter(Boolean);
    const ready = testedDocuments.length ? (await Promise.all(testedDocuments.map(storageReady))).every(Boolean) : false;
    checks.push(ready ? ok("download_ready", "Nedlasting", "PDF-nedlasting er klar.") : fail("download_ready", "Nedlasting", "Fant ikke storage object for ett eller flere dokumenter."));
  } catch (error) {
    console.error("prepare portal storage test failed:", { inputId: params.id, quoteId: quote.id, error });
    checks.push(fail("download_ready", "Nedlasting", error.message || "Kunne ikke teste nedlasting."));
  }

  checks.push(ok("approval_actions", "Godkjenning", "Portal støtter godkjenn og be om endring."));
  checks.push(ok("messages", "Meldinger", "Portal meldingsflyt er aktiv."));

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_CRM_PUBLIC_URL || "";
  const portalUrl = portalToken?.token ? `${origin}/portal/${portalToken.token}` : null;

  return NextResponse.json({
    quote,
    portalUrl,
    checks,
  });
}
