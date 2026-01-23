import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function PATCH(req, ctx) {
  const { id, noteId } = ctx.params;
  const body = await req.json().catch(() => ({}));

  // log edit (best effort)
  await supabaseAdmin.from("quote_note_edits").insert({
    note_id: noteId,
    editor_id: body.editor_id ?? null,
    previous_value: body.previous_value ?? null,
    new_value: body.note ?? null,
  });

  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .update({
      note: body.note,
      updated_at: new Date().toISOString(),
      updated_by: body.editor_id ?? null,
    })
    .eq("id", noteId)
    .eq("quote_id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
