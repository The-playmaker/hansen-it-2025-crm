import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMe } from "@/lib/requireMe";

export async function POST(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { hours, description } = await req.json();
  const h = Number(hours);
  if (!h || isNaN(h) || h <= 0) return NextResponse.json({ error: "Invalid hours" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // use assigned employee on request if you want, otherwise null
  const { data: row, error } = await supabase
    .from("quote_time_entries")
    .insert({
      quote_id: params.id,
      hours: h,
      description: description?.trim() || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data: row });
}
