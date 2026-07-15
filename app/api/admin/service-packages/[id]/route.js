import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { servicePackageCategories } from "@/lib/securityScan/recommendations";

export const dynamic = "force-dynamic";

function cleanNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cleanPayload(body = {}) {
  const payload = {};
  if ("name" in body) payload.name = String(body.name || "").trim();
  if ("slug" in body) payload.slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if ("category" in body) payload.category = servicePackageCategories.includes(body.category) ? body.category : "support";
  if ("short_description" in body) payload.short_description = String(body.short_description || "").trim() || null;
  if ("long_description" in body) payload.long_description = String(body.long_description || "").trim() || null;
  if ("target_customer" in body) payload.target_customer = String(body.target_customer || "").trim() || null;
  if ("price_from" in body) payload.price_from = cleanNumber(body.price_from);
  if ("fixed_price" in body) payload.fixed_price = cleanNumber(body.fixed_price);
  if ("hourly_estimate_min" in body) payload.hourly_estimate_min = cleanNumber(body.hourly_estimate_min);
  if ("hourly_estimate_max" in body) payload.hourly_estimate_max = cleanNumber(body.hourly_estimate_max);
  if ("is_active" in body) payload.is_active = body.is_active !== false;
  payload.updated_at = new Date().toISOString();
  return payload;
}

export async function GET(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ configured: false, data: null });

  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .select("*, service_package_items(*), service_package_assets(*)")
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ configured: true, error: error.message, data: null }, { status: 404 });
  return NextResponse.json({ configured: true, data });
}

export async function PATCH(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "admin")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const payload = cleanPayload(await request.json());
  if ("name" in payload && !payload.name) return NextResponse.json({ error: "Navn er påkrevd." }, { status: 400 });
  if ("slug" in payload && !payload.slug) return NextResponse.json({ error: "Slug er påkrevd." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("service_packages")
    .update(payload)
    .eq("id", params.id)
    .select("*, service_package_items(*), service_package_assets(*)")
    .single();

  if (error) {
    console.error("service_packages update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function DELETE(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "admin")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const { error } = await supabaseAdmin.from("service_packages").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
