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

  let query = supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*)")
    .eq("is_active", true);

  if (packageIds.length) query = query.in("id", packageIds);
  else query = query.in("slug", recommendation.packageSlugs || []);

  const { data: packages, error: packageError } = await query;
  if (packageError) {
    console.error("service package quote package read error:", packageError);
    return NextResponse.json({ error: packageError.message }, { status: 500 });
  }
  if (!packages?.length) return NextResponse.json({ error: "Fant ingen aktive anbefalte produktpakker." }, { status: 404 });

  const subtotal = packages.reduce((sum, pkg) => sum + priceOf(pkg), 0);
  const vat = Math.round(subtotal * 0.25);
  const title = `Tiltakspakke: ${report.domain || row.domain || "Security report"}`;
  const description = [
    recommendation.title,
    recommendation.text,
    `Estimert arbeid: ${recommendation.estimate}`,
    `Rapport: ${row.id}`
  ].filter(Boolean).join("\n\n");

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from("quotes")
    .insert({
      customer_id: row.customer_id || null,
      lead_id: row.lead_id || null,
      source_request_id: row.request_id || null,
      security_report_id: row.id,
      title,
      description,
      status: "kladd",
      total_ex_vat: subtotal,
      total_vat: vat,
      total_inc_vat: subtotal + vat,
      internal_notes: `Opprettet fra anbefalte service packages i Phoenix Security Report ${row.id}.`,
      customer_note: "Forslag til tiltakspakke basert på passiv sikkerhetsrapport. Tilbud sendes ikke automatisk."
    })
    .select("*")
    .single();

  if (quoteError) {
    console.error("service package quote create error:", quoteError);
    return NextResponse.json({ error: quoteError.message }, { status: 500 });
  }

  const items = packages.map((pkg) => ({
    quote_id: quote.id,
    description: `${pkg.name}: ${pkg.short_description || pkg.long_description || "Produktpakke"}`,
    quantity: 1,
    unit_price: priceOf(pkg),
    discount: 0,
    vat_rate: 25,
    line_total_ex_vat: priceOf(pkg)
  }));

  if (items.length) {
    const { error: itemError } = await supabaseAdmin.from("quote_items").insert(items);
    if (itemError) console.error("service package quote item create error:", itemError);
  }

  return NextResponse.json({ data: quote, packages });
}
