import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { PortalTokenError, resolveQuotePortalToken } from "@/lib/portal/resolveQuotePortalToken";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, type, message } = await req.json();
    if (!token || !type) return NextResponse.json({ error: "Mangler token eller handling." }, { status: 400 });
    if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Kundeportal er ikke konfigurert." }, { status: 503 });

    const { quote } = await resolveQuotePortalToken(token);

    const isApproved = type === "approved";
    const isChangesRequested = type === "changes_requested";
    if (isChangesRequested && !String(message || "").trim()) {
      return NextResponse.json({ error: "Skriv en kort melding om hva du onsker endret." }, { status: 400 });
    }

    const portalStatus = isApproved ? "approved" : type === "declined" ? "declined" : "changes_requested";
    const quoteStatus = isApproved ? "godkjent" : type === "declined" ? "avslatt" : "endringer onsket";
    const timestampColumn = isApproved
      ? { approved_at: new Date().toISOString() }
      : isChangesRequested
        ? { changes_requested_at: new Date().toISOString() }
        : {};

    const { error: quoteUpdateError } = await supabaseAdmin
      .from("quotes")
      .update({ status: quoteStatus, updated_at: new Date().toISOString(), ...timestampColumn })
      .eq("id", quote.id);

    if (quoteUpdateError) {
      console.error("portal quote status update failed:", quoteUpdateError);
      await supabaseAdmin.from("quote_notes").insert({ quote_id: quote.id, author_id: null, note: `[PORTAL ACTION] ${portalStatus}` });
    }

    if (quote.source_request_id) {
      await supabaseAdmin
        .from("requests")
        .update({ portal_status: portalStatus, status: quoteStatus, ...timestampColumn })
        .eq("id", quote.source_request_id);
    }

    const portalMessage = isApproved
      ? "Tilbudet er godkjent. Hansen IT tar kontakt for videre fremdrift."
      : String(message || "").trim();

    await supabaseAdmin.from("quote_messages").insert({
      quote_id: quote.id,
      author_type: "customer",
      author_name: "Kunde",
      message: portalMessage
    });

    await supabaseAdmin.from("quote_notes").insert({
      quote_id: quote.id,
      author_id: null,
      note: `[PORTAL] ${portalStatus}: ${portalMessage}`
    });

    return NextResponse.json({ ok: true, status: portalStatus });
  } catch (error) {
    if (error instanceof PortalTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("portal action failed:", error);
    return NextResponse.json({ error: "Kunne ikke oppdatere portalstatus." }, { status: 500 });
  }
}
