import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("quote_notes")
    .update(body)
    .eq("id", params.noteId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
