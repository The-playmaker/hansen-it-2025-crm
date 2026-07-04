import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from("phoenix_ideas")
    .update({ title: body.title, description: body.description || null, category: body.category || null, status: body.status || "parked", priority: body.priority || "normal", updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_request, { params }) {
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  const { error } = await supabaseAdmin.from("phoenix_ideas").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
