import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const supabase = supabaseAdmin;
  const id = params.id;

  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase GET error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(req, { params }) {
  const supabase = supabaseAdmin;
  const id = params.id;
  const body = await req.json();

  const { data, error } = await supabase
    .from("requests")
    .update(body)
    .eq("id", id)
    .select();

  if (error) {
    console.error("Supabase PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}
