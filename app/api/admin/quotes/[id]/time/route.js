import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { data, error } = await supabaseAdmin
    .from("quote_time_entries")
    .select("*")
    .eq("quote_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req, { params }) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("quote_time_entries")
    .insert([{ ...body, quote_id: params.id }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
