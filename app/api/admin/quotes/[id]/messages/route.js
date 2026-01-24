import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PREFIX = "[MSG] ";

export async function GET(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .select("*")
    .eq("quote_id", id)
    .like("note", `${PREFIX}%`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, { params }) {
  const id = params?.id;
  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.message || "").trim();
  if (!text) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  // author_id uuid (eller null hvis "customer")
  const author_id = body.author_id ? String(body.author_id) : null;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .insert({
      quote_id: id,
      author_id,
      note: `${PREFIX}${text}`,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
