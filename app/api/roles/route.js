import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  try {
    const { name, permissions } = await req.json();
    const supabase = getSupabaseServer();

    // Sjekk om rollen finnes
    const { data: existing } = await supabase
      .from("roles")
      .select("*")
      .eq("name", name)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Role already exists" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("roles")
      .insert({ name, permissions })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to create role:", err);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
