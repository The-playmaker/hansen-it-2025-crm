import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PortalTokenError, resolveQuotePortalToken } from "@/lib/portal/resolveQuotePortalToken";

export const dynamic = "force-dynamic";

async function getQuoteFromToken(token) {
  try {
    return await resolveQuotePortalToken(token);
  } catch (error) {
    if (error instanceof PortalTokenError) throw error;
    console.error("portal message token resolve failed:", error);
    throw new PortalTokenError("Ugyldig portal-lenke.", 401);
  }
}

export async function GET(_req, { params }) {
  try {
    const { quote } = await getQuoteFromToken(params.token);
    const { data, error } = await supabaseAdmin
      .from("quote_messages")
      .select("*")
      .eq("quote_id", quote.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("portal messages read failed:", error);
      return NextResponse.json({ error: "Kunne ikke hente meldinger." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof PortalTokenError ? error.status : 401;
    return NextResponse.json({ error: error.message || "Ugyldig portal-lenke." }, { status });
  }
}

export async function POST(req, { params }) {
  try {
    const { quote } = await getQuoteFromToken(params.token);
    const body = await req.json();
    const message = String(body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Melding mangler." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("quote_messages")
      .insert([{ quote_id: quote.id, author_type: "customer", author_name: "Kunde", message }])
      .select()
      .single();

    if (error) {
      console.error("portal message insert failed:", error);
      return NextResponse.json({ error: "Kunne ikke lagre meldingen." }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const status = error instanceof PortalTokenError ? error.status : 401;
    return NextResponse.json({ error: error.message || "Ugyldig portal-lenke." }, { status });
  }
}
