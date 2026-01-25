import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isUuid(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(_req, ctx) {
  const id = ctx.params.id;

  // Returner "vanlige notes" (ikke messages som lagres som [MSG])
  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .select("*")
    .eq("quote_id", id)
    .not("note", "ilike", "[MSG]%")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, ctx) {
  const id = ctx.params.id;
  const body = await req.json().catch(() => ({}));

  const note = String(body.note || "").trim();
  if (!note) return NextResponse.json({ error: "Missing note" }, { status: 400 });

  // author_id i DB er UUID hos deg → hvis ikke uuid, sett null (unngår "2" crash)
  const author_id = isUuid(body.author_id) ? body.author_id : null;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .insert({
      quote_id: id,
      author_id,
      note,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
