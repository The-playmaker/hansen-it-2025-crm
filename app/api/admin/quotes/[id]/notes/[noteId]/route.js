import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function isUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export async function PATCH(req, ctx) {
  const { id, noteId } = ctx.params;
  const body = await req.json().catch(() => ({}));

  const note = String(body.note || "").trim();
  if (!note) return NextResponse.json({ error: "Missing note" }, { status: 400 });

  // DB hos deg ser ut til å forvente UUID her → hvis du sender "2" så kræsjer det.
  const updated_by = isUuid(body.editor_id) ? body.editor_id : null;

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .update({
      note,
      updated_at: new Date().toISOString(),
      updated_by,
    })
    .eq("id", noteId)
    .eq("quote_id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
