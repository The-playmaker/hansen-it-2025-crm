import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMe } from "@/lib/requireMe";

export async function POST(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { employee_id } = await req.json(); // bigint or null
  const value = employee_id ? Number(employee_id) : null;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("requests")
    .update({ employee_id: value })
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
