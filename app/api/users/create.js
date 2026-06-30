import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, role = "worker" } = body;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const { data: existing } = await supabase.from("employees").select("*").eq("email", email).maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    const { data, error } = await supabase.from("employees").insert({ name, email, role }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Could not create user" }, { status: 500 });
  }
}
