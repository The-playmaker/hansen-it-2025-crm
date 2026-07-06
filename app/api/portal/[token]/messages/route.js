import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

async function getQuoteIdFromToken(token) {
  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("quote_id")
    .eq("token", token)
    .single();

  if (error) {
    throw new Error("Invalid token");
  }

  return data.quote_id;
}

export async function GET(req, { params }) {
  try {
    const quoteId = await getQuoteIdFromToken(params.token);
    const { data, error } = await supabaseAdmin
      .from("quote_messages")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}

export async function POST(req, { params }) {
  try {
    const quoteId = await getQuoteIdFromToken(params.token);
    const body = await req.json();
    const message = String(body.message || "").trim();
    if (!message) {
      return NextResponse.json({ error: "Melding mangler." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("quote_messages")
      .insert([{ quote_id: quoteId, author_type: "customer", author_name: "Kunde", message }])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
