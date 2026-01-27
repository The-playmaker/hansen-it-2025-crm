import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req, ctx) {
  const id = ctx.params.id;

  const token =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36);

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 3);

  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .insert({
      quote_id: id,
      token,
      expires_at: expires.toISOString(),
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
