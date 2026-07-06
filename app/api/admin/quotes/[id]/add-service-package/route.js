import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function packagePrice(pkg = {}) {
  return asNumber(pkg.fixed_price || pkg.price_from, 0);
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const packageId = String(body.service_package_id || "").trim();
  if (!packageId) return NextResponse.json({ error: "service_package_id er påkrevd." }, { status: 400 });

  let quoteUsesQuotesTable = false;
  let { data: quote, error: quoteError } = await supabaseAdmin
    .from("requests")
    .select("id, customer_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!quote) {
    const fallback = await supabaseAdmin
      .from("quotes")
      .select("id, customer_id, source_request_id")
      .eq("id", params.id)
      .maybeSingle();
    quote = fallback.data;
    quoteError = fallback.error;
    quoteUsesQuotesTable = Boolean(quote);
  }

  if (quoteError || !quote) return NextResponse.json({ error: "Fant ikke tilbudet." }, { status: 404 });

  const { data: pkg, error: packageError } = await supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*)")
    .eq("id", packageId)
    .maybeSingle();

  if (packageError || !pkg) return NextResponse.json({ error: "Fant ikke produktpakken." }, { status: 404 });

  const { data: existingItem } = await supabaseAdmin
    .from("quote_items")
    .select("id")
    .eq(quoteUsesQuotesTable ? "quote_id" : "request_id", quote.id)
    .eq("service_package_id", pkg.id)
    .maybeSingle();

  if (existingItem && !body.allow_duplicate) {
    return NextResponse.json({ error: "Pakken ligger allerede i tilbudet.", code: "package_already_exists" }, { status: 409 });
  }

  const price = packagePrice(pkg);
  const includedItems = [...(pkg.service_package_items || [])]
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((item) => ({ title: item.title, description: item.description }));

  const payload = {
    ...(quoteUsesQuotesTable ? { quote_id: quote.id } : { request_id: quote.id }),
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
    sort_order: asNumber(body.sort_order, 100),
    metadata: {
      source: body.source || "manual",
      scan_finding_ids: Array.isArray(body.scan_finding_ids) ? body.scan_finding_ids : [],
      included_items: includedItems,
      package_slug: pkg.slug,
      package_category: pkg.category,
    },
  };

  const { data: item, error } = await supabaseAdmin
    .from("quote_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("add service package quote item error:", error);
    return NextResponse.json({ error: "Kunne ikke legge produktpakken til tilbudet. Kjør siste migration for quote_items metadata." }, { status: 500 });
  }

  return NextResponse.json({ data: { ...item, service_package: pkg }, quote_id: quote.id });
}
