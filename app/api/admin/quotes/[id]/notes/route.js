import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, ctx) {
  const id = ctx.params.id;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .select("*")
    .eq("quote_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, ctx) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .insert({
      quote_id: id,
      author_id: body.author_id ?? null,
      note: body.note ?? "",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
