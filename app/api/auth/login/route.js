import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Innlogging er ikke konfigurert." }, { status: 503 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Feil e-post eller passord." }, { status: 401 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.warn("Supabase auth login failed", { email, message: error.message });
    return NextResponse.json({ error: "Feil e-post eller passord." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
