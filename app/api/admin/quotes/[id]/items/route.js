import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

export const dynamic = "force-dynamic";

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function priceOf(pkg = {}) {
  return asNumber(pkg.fixed_price || pkg.price_from, 0);
}

function normalizeItems(items = [], packages = []) {
  const packageMap = new Map(packages.map((pkg) => [String(pkg.id), pkg]));
  return items.map((item) => ({
    ...item,
    service_package: item.service_package_id ? packageMap.get(String(item.service_package_id)) || null : null,
  }));
}

async function loadPackage(packageId) {
  if (!packageId) return null;
  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*)")
    .eq("id", packageId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function GET(_request, { params }) {
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

  const { data: items, error } = await supabaseAdmin
    .from("quote_items")
    .select("*")
    .or([quote.id, quote.source_request_id].filter(Boolean).flatMap((id) => [`quote_id.eq.${id}`, `request_id.eq.${id}`]).join(","))
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("quote items read error:", error);
    return NextResponse.json({ error: "Kunne ikke hente tilbudslinjer. Kjør siste database-migration hvis quote_items mangler." }, { status: 500 });
  }

  const packageIds = [...new Set((items || []).map((item) => item.service_package_id).filter(Boolean))];
  let packages = [];
  if (packageIds.length) {
    const packageResult = await supabaseAdmin
      .from("service_packages")
      .select("*, service_package_items(*)")
      .in("id", packageIds);
    packages = packageResult.data || [];
  }

  return NextResponse.json({ data: normalizeItems(items || [], packages) });
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const packageId = String(body.service_package_id || body.packageId || "").trim();
  const pkg = await loadPackage(packageId);
  if (!pkg) return NextResponse.json({ error: "Produktpakken ble ikke funnet." }, { status: 404 });

  const quantity = asNumber(body.quantity, 1) || 1;
  const unitPrice = asNumber(body.unit_price, priceOf(pkg));
  const vatRate = asNumber(body.vat_rate, 25);
  const lineTotalExVat = Math.round(quantity * unitPrice);
  const lineTotal = Math.round(lineTotalExVat * (1 + vatRate / 100));

  const payload = {
    quote_id: quote.id,
    service_package_id: pkg.id,
    item_type: "package",
    title: pkg.name,
    description: pkg.short_description || pkg.long_description || "Produktpakke fra Hansen IT",
    quantity,
    unit: body.unit || "pakke",
    unit_price: unitPrice,
    discount: 0,
    vat_rate: vatRate,
    line_total_ex_vat: lineTotalExVat,
    line_total: lineTotal,
    sort_order: asNumber(body.sort_order, 100),
  };

  const { data, error } = await supabaseAdmin
    .from("quote_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("quote item insert error:", error);
    return NextResponse.json({ error: "Kunne ikke legge pakken til tilbudet. Kjør siste database-migration og prøv igjen." }, { status: 500 });
  }

  return NextResponse.json({ data: { ...data, service_package: pkg } });
}
