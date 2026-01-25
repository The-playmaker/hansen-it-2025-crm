import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const isUuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function GET(req, ctx) {
  try {
    const id = ctx?.params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("quote_notes")
      .select("*")
      .eq("quote_id", id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    console.error("NOTES GET ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req, ctx) {
  try {
    const id = ctx?.params?.id;
    const body = await req.json().catch(() => ({}));

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const note = String(body.note || "").trim();
    if (!note) return NextResponse.json({ error: "Missing note" }, { status: 400 });

    // ✅ Viktig: aldri putt "2" inn i uuid-kolonne
    const author_id = isUuid(body.author_id) ? body.author_id : null;

    const { data, error } = await supabaseAdmin
      .from("quote_notes")
      .insert({ quote_id: id, author_id, note })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error("NOTES POST ERROR:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
