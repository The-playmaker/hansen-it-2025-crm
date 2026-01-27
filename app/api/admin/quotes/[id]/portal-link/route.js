import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
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
