import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(_req, { params }) {
  const token = String(params?.token || "");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = getSupabaseServer();

  // 1) validate token
  const { data: tokenRow, error: tokenErr } = await supabase
    .from("quote_portal_tokens")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (tokenErr || !tokenRow) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Expired token" }, { status: 410 });
  }

  // 2) load quote
  const { data: quote, error: quoteErr } = await supabase
    .from("requests")
    .select("*")
    .eq("id", tokenRow.quote_id)
    .maybeSingle();

  if (quoteErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // 3) employee (optional)
  let employee = null;
  if (quote.employee_id) {
    const { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", quote.employee_id)
      .maybeSingle();
    employee = emp ?? null;
  }

  // 4) time entries
  const { data: timeEntries } = await supabase
    .from("quote_time_entries")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: false });

  // 5) attachments
  const { data: attachments } = await supabase
    .from("quote_attachments")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: false });

  // 6) portal documents
  const { data: documents } = await supabase
    .from("quote_documents")
    .select("*")
    .eq("quote_id", quote.id)
    .eq("visible_in_portal", true)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    token: {
      quote_id: tokenRow.quote_id,
      expires_at: tokenRow.expires_at,
    },
    quote,
    employee,
    timeEntries: timeEntries || [],
    attachments: attachments || [],
    documents: documents || [],
  });
}
