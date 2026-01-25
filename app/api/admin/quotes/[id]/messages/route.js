import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const id = ctx.params.id;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .select("*")
    .eq("quote_id", id)
    .ilike("note", "[MSG]%")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, ctx) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const message = String(body.message || body.note || "").trim();
  if (!message) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  // messages fra admin: lagres som note (kundeportal gjør samme mønster)
  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .insert({
      quote_id: id,
      author_id: null,            // viktig: unngå uuid crash
      note: `[MSG] ${message}`,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
