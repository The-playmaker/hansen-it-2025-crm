import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const isUuid = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

export async function POST(req, { params }) {
  const id = params?.id;
  const body = await req.json().catch(() => ({}));

  const msg = String(body.message || "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!msg) return NextResponse.json({ error: "Missing message" }, { status: 400 });

  const author_id = isUuid(body.author_id) ? body.author_id : null;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .insert({
      quote_id: id,
      author_id,
      note: `[ADMIN MSG] ${msg}`, // ✅ messages lagres i notes
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
