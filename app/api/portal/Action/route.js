import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, type, message } = await req.json();
    if (!token || !type) return NextResponse.json({ error: "Missing token/type" }, { status: 400 });

    const supabase = getSupabaseServer();
    const { data: tokenRow } = await supabase
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "Expired token" }, { status: 410 });

    const isApproved = type === "approved";
    const isChangesRequested = type === "changes_requested";
    if (isChangesRequested && !String(message || "").trim()) {
      return NextResponse.json({ error: "Skriv en kort melding om hva du ønsker endret." }, { status: 400 });
    }

    const portalStatus = isApproved ? "approved" : type === "declined" ? "declined" : "changes_requested";
    const requestStatus = isApproved ? "godkjent" : type === "declined" ? "avslått" : "endringer ønsket";
    const timestampColumn = isApproved ? { approved_at: new Date().toISOString() } : isChangesRequested ? { changes_requested_at: new Date().toISOString() } : {};

    const { error: updateError } = await supabase
      .from("requests")
      .update({ portal_status: portalStatus, status: requestStatus, ...timestampColumn })
      .eq("id", tokenRow.quote_id);

    if (updateError) {
      await supabase.from("quote_notes").insert({ quote_id: tokenRow.quote_id, author_id: null, note: `[PORTAL ACTION] ${portalStatus}` });
    }

    const portalMessage = isApproved
      ? "Tilbudet er godkjent. Hansen IT tar kontakt for videre fremdrift."
      : String(message || "").trim();

    await supabase.from("quote_messages").insert({
      quote_id: tokenRow.quote_id,
      author_type: "customer",
      author_name: "Kunde",
      message: portalMessage
    }).select().single();

    await supabase.from("quote_notes").insert({
      quote_id: tokenRow.quote_id,
      author_id: null,
      note: `[PORTAL] ${portalStatus}: ${portalMessage}`
    });

    return NextResponse.json({ ok: true, status: portalStatus });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
