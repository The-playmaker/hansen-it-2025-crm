import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data: tokens, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("token,quote_id,expires_at,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((tokens || []).map((t) => t.quote_id).filter(Boolean)));
  let quotesById = {};

  if (ids.length) {
    const { data: quotes } = await supabaseAdmin
      .from("requests")
      .select("id,name,email,status")
      .in("id", ids);

    (quotes || []).forEach((q) => (quotesById[q.id] = q));
  }

  const rows = (tokens || []).map((t) => ({
    ...t,
    quote: quotesById[t.quote_id] || null,
  }));

  return NextResponse.json({ data: rows });
}
