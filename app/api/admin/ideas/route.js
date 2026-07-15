import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasSupabaseAdminConfig) return NextResponse.json({ configured: false, data: [] });

  const { data, error } = await supabaseAdmin
    .from("phoenix_ideas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ configured: true, error: error.message, data: [] }, { status: 500 });
  return NextResponse.json({ configured: true, data: data || [] });
}

export async function POST(request) {
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  const body = await request.json();
  const { data, error } = await supabaseAdmin
    .from("phoenix_ideas")
    .insert({ title: body.title, description: body.description || null, category: body.category || null, status: body.status || "parked", priority: body.priority || "normal" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
