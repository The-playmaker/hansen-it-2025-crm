import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { ensureQuotePortalToken } from "@/lib/portal/quotePortalTokens";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  try {
    const { data } = await ensureQuotePortalToken(params.id);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Kunne ikke hente portal-token." }, { status: 400 });
  }
}

export async function POST(_req, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  try {
    const { data, reused } = await ensureQuotePortalToken(params.id);
    return NextResponse.json({ data, reused });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Kunne ikke opprette portal-token." }, { status: 400 });
  }
}
