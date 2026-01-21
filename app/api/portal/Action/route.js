import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, type } = await req.json();
    if (!token || !type) return NextResponse.json({ error: "Missing token/type" }, { status: 400 });

    const supabase = getSupabaseServer();

    const { data: tokenRow } = await supabase
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 404 });

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Expired token" }, { status: 410 });
    }

    // prøv portal_status, fallback til note
    const { error: upErr } = await supabase
      .from("requests")
      .update({ portal_status: type })
      .eq("id", tokenRow.quote_id);

    if (upErr) {
      await supabase.from("quote_notes").insert({
        quote_id: tokenRow.quote_id,
        author_id: null,
        note: `[PORTAL ACTION] ${type}`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
