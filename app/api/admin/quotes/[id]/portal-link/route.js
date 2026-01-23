import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function getMeFromCookie(req) {
  const raw = req.cookies.get("casdoorUser")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function POST(req, { params }) {
  const me = getMeFromCookie(req);
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // valgfritt: kun admin/worker som får lage portal link
  if (!["admin", "worker", "manager"].includes(me.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const quoteId = params.id;

  const token =
    (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
    Math.random().toString(36).slice(2) + Date.now().toString(36);

  const expires = new Date();
  expires.setMonth(expires.getMonth() + 3);

  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .insert({
      quote_id: quoteId,
      token,
      expires_at: expires.toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.json({
    token: data.token,
    url: `${base}/portal/${data.token}`,
    expires_at: data.expires_at,
  });
}
