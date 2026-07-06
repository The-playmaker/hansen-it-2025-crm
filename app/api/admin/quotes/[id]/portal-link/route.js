import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("*")
    .eq("quote_id", params.id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req, { params }) {
  const existing = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("*")
    .eq("quote_id", params.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data) return NextResponse.json({ data: existing.data, reused: true });

  const token = randomBytes(32).toString("hex");
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + 30); // 30 days expiry

  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .insert([
      {
        quote_id: params.id,
        token,
        expires_at: expires_at.toISOString(),
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
