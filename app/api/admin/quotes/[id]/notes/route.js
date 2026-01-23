import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMe } from "@/lib/requireMe";

export async function POST(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "Missing note" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // map email -> employee.id (bigint)
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .ilike("email", me.email)
    .maybeSingle();

  const author_id = emp?.id ?? null;

  const { data, error } = await supabase
    .from("quote_notes")
    .insert({ quote_id: params.id, author_id, note: note.trim() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
