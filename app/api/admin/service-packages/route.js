import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { servicePackageCategories } from "@/lib/securityScan/recommendations";

export const dynamic = "force-dynamic";

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanPayload(body = {}) {
  const category = servicePackageCategories.includes(body.category) ? body.category : "support";
  return {
    name: String(body.name || "").trim(),
    slug: String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""),
    category,
    short_description: String(body.short_description || "").trim() || null,
    long_description: String(body.long_description || "").trim() || null,
    target_customer: String(body.target_customer || "").trim() || null,
    price_from: cleanNumber(body.price_from),
    fixed_price: cleanNumber(body.fixed_price),
    hourly_estimate_min: cleanNumber(body.hourly_estimate_min),
    hourly_estimate_max: cleanNumber(body.hourly_estimate_max),
    is_active: body.is_active !== false
  };
}

export async function GET() {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ configured: false, data: [] });

  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*), service_package_assets(*)")
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("service_packages read error:", error);
    return NextResponse.json({ configured: true, data: [], error: error.message }, { status: 500 });
  }

  return NextResponse.json({ configured: true, data: data || [] });
}

export async function POST(request) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json();
  const payload = cleanPayload(body);
  if (!payload.name || !payload.slug) return NextResponse.json({ error: "Navn og slug er påkrevd." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .insert(payload)
    .select("*, service_package_items(*), service_package_assets(*)")
    .single();

  if (error) {
    console.error("service_packages insert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
