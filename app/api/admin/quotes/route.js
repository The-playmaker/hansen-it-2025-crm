import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const search = (url.searchParams.get("search") || "").trim();

  let q = supabaseAdmin
    .from("requests")
    .select("id,name,email,status,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search) {
    // best-effort søk (name/email/id)
    q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,id::text.ilike.%${search}%`);
  }

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
