import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/captcha/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60_000;

function rateLimitResponse(resetAt) {
  const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "For mange innloggingsforsøk. Prøv igjen om noen minutter." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter) },
    }
  );
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const password = String(body.password || "");
  const clientIp = getClientIp(req);
  const rateKey = `login:${clientIp || "unknown"}:${email.toLowerCase()}`;

  const existing = checkRateLimit(rateKey, {
    limit: LOGIN_LIMIT,
    windowMs: LOGIN_WINDOW_MS,
    consume: false,
  });
  if (!existing.ok) {
    return rateLimitResponse(existing.resetAt);
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Innlogging er ikke konfigurert." }, { status: 503 });
  }

  if (!email || !password) {
    checkRateLimit(rateKey, { limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS });
    return NextResponse.json({ error: "Feil e-post eller passord." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.warn("Supabase auth login failed", { email, message: error.message });
    const rateLimit = checkRateLimit(rateKey, { limit: LOGIN_LIMIT, windowMs: LOGIN_WINDOW_MS });
    if (!rateLimit.ok) {
      return rateLimitResponse(rateLimit.resetAt);
    }
    return NextResponse.json({ error: "Feil e-post eller passord." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
