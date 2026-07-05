import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { data, error } = await supabaseAdmin
    .from("quote_messages")
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
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Melding mangler." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("quote_messages")
    .insert([{
      quote_id: params.id,
      author_id: body.author_id || null,
      author_type: body.author_type || "admin",
      author_name: body.author_name || "Hansen IT",
      message
    }])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
