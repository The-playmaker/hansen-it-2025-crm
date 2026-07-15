import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "admin")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json();
  const payload = {
    package_id: params.id,
    title: String(body.title || "").trim(),
    description: String(body.description || "").trim() || null,
    quantity: number(body.quantity, 1),
    unit: String(body.unit || "stk").trim() || "stk",
    unit_price: number(body.unit_price, 0),
    sort_order: number(body.sort_order, 0)
  };
  if (!payload.title) return NextResponse.json({ error: "Tittel er påkrevd." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("service_package_items").insert(payload).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
