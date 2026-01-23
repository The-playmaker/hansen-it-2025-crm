import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMe } from "@/lib/requireMe";

export async function POST(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const token =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36);

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 3);

  const { data, error } = await supabase
    .from("quote_portal_tokens")
    .insert({ quote_id: params.id, token, expires_at: expires.toISOString() })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ token: data.token });
}
