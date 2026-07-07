import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSecurityScanReport } from "@/lib/securityScan/storage";
import { buildReportRecommendation } from "@/lib/securityScan/recommendations";

export const dynamic = "force-dynamic";

function innerReport(row = {}) {
  return row.report && typeof row.report === "object" ? row.report : row;
}

function priceOf(pkg = {}) {
  return Number(pkg.fixed_price || pkg.price_from || 0);
}

function customerLabel(row = {}) {
  return row.customer_name || row.company || row.name || row.email || "Security report-kunde";
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const reportResult = await getSecurityScanReport(params.id);
  if (reportResult.error || !reportResult.data) {
    return NextResponse.json({ error: reportResult.error || "Fant ikke rapport." }, { status: 404 });
  }

  const row = reportResult.data;
  const report = innerReport(row);
  const recommendation = buildReportRecommendation(report);
  const packageIds = Array.isArray(body.packageIds) ? body.packageIds.filter(Boolean) : [];
  const isScanReport = row.source_table === "scan_reports";
  const reportQuoteId = row.quote_id || row.authorization?.quote_id || null;
  const reportCustomerId = row.customer_id || row.authorization?.customer_id || null;
  const reportContactId = row.contact_id || row.authorization?.contact_id || null;
  const reportRequestId = row.request_id || row.authorization?.request_id || null;
  const reportLeadId = row.lead_id || row.authorization?.lead_id || null;

  let query = supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*)")
    .eq("is_active", true);

  if (packageIds.length) query = query.in("id", packageIds);
  else query = query.in("slug", recommendation.packageSlugs || []);

  const { data: packages, error: packageError } = await query;
  if (packageError) {
    console.error("service package quote package read error:", packageError);
    return NextResponse.json({ error: "Kunne ikke hente produktpakker." }, { status: 500 });
  }
  if (!packages?.length) return NextResponse.json({ error: "Fant ingen aktive anbefalte produktpakker." }, { status: 404 });

  const subtotal = packages.reduce((sum, pkg) => sum + priceOf(pkg), 0);
  const title = `Tiltakspakke: ${report.domain || row.domain || "Security report"}`;
  const message = [
    recommendation.title,
    recommendation.text,
    `Estimert arbeid: ${recommendation.estimate}`,
    `Rapport: ${row.id}`
  ].filter(Boolean).join("\n\n");

  let quote = null;
  if (reportQuoteId) {
    const existingById = await supabaseAdmin.from("quotes").select("*").eq("id", reportQuoteId).maybeSingle();
    if (existingById.data) quote = existingById.data;
  }

  if (!quote) {
    const existingByReport = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq(isScanReport ? "scan_report_id" : "security_report_id", row.id)
      .maybeSingle();
    if (existingByReport.data) quote = existingByReport.data;
  }

  if (!quote && reportRequestId) {
    const existingByRequest = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("source_request_id", reportRequestId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingByRequest.data) quote = existingByRequest.data;
  }

  if (!quote && reportCustomerId) {
    const existingByCustomer = await supabaseAdmin
      .from("quotes")
      .select("*")
      .eq("customer_id", reportCustomerId)
      .ilike("title", `%${report.domain || row.domain || "Security"}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingByCustomer.data) quote = existingByCustomer.data;
  }

  if (!quote) {
    const quotePayload = {
      title,
      customer_id: reportCustomerId || null,
      contact_id: reportContactId || null,
      lead_id: reportLeadId || null,
      source_request_id: reportRequestId || null,
      status: "kladd",
      description: `${message}\n\nEstimert subtotal fra anbefalte pakker: ${subtotal.toLocaleString("nb-NO")} kr eks. mva.`,
      internal_notes: `Opprettet fra sikkerhetsrapport ${row.id}`,
    };
    if (isScanReport) quotePayload.scan_report_id = row.id;
    else quotePayload.security_report_id = row.id;

    const { data, error } = await supabaseAdmin
      .from("quotes")
      .insert(quotePayload)
      .select("*")
      .single();

    if (error) {
      console.error("service package request quote create error:", error);
      return NextResponse.json({ error: "Kunne ikke opprette tilbudskladd." }, { status: 500 });
    }
    quote = data;
  }

  if (quote && isScanReport) {
    await Promise.all([
      supabaseAdmin.from("scan_reports").update({ quote_id: quote.id }).eq("id", row.id),
      row.authorization_id ? supabaseAdmin.from("scan_authorizations").update({ quote_id: quote.id }).eq("id", row.authorization_id) : Promise.resolve()
    ]);
  }

  const { data: existingItems } = await supabaseAdmin
    .from("quote_items")
    .select("service_package_id")
    .eq("quote_id", quote.id);
  const existingPackageIds = new Set((existingItems || []).map((item) => String(item.service_package_id)).filter(Boolean));

  const items = packages.filter((pkg) => !existingPackageIds.has(String(pkg.id))).map((pkg, index) => {
    const price = priceOf(pkg);
    const includedItems = [...(pkg.service_package_items || [])]
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map((item) => ({ title: item.title, description: item.description }));

    return {
      quote_id: quote.id,
      service_package_id: pkg.id,
      item_type: "package",
      title: pkg.name,
      description: pkg.short_description || pkg.long_description || "Produktpakke fra Hansen IT",
      quantity: 1,
      unit: "pakke",
      unit_price: price,
      discount: 0,
      vat_rate: 25,
      line_total_ex_vat: price,
      line_total: Math.round(price * 1.25),
      sort_order: 100 + index,
      metadata: {
        source: "scan_report",
        report_id: row.id,
        report_table: row.source_table || "security_scan_reports",
        included_items: includedItems,
        package_slug: pkg.slug,
        package_category: pkg.category,
      },
    };
  });

  if (items.length) {
    const { error: itemError } = await supabaseAdmin.from("quote_items").insert(items);
    if (itemError) {
      console.error("service package quote item create error:", itemError);
      return NextResponse.json({ error: "Tilbud ble opprettet, men pakkelinjer feilet. Kjør siste quote_items-migration." }, { status: 500 });
    }
  }

  return NextResponse.json({ data: quote, packages, added: items.length, url: `/admin/quotes/${quote.id}` });
}
