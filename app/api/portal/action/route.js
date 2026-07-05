import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, type, message } = await req.json();
    if (!token || !type) return NextResponse.json({ error: "Mangler token eller handling." }, { status: 400 });
    if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Kundeportal er ikke konfigurert." }, { status: 503 });

    const { data: tokenRow } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ error: "Ugyldig portal-lenke." }, { status: 404 });
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return NextResponse.json({ error: "Portal-lenken er utløpt." }, { status: 410 });

    const isApproved = type === "approved";
    const isChangesRequested = type === "changes_requested";
    if (isChangesRequested && !String(message || "").trim()) {
      return NextResponse.json({ error: "Skriv en kort melding om hva du ønsker endret." }, { status: 400 });
    }

    const portalStatus = isApproved ? "approved" : type === "declined" ? "declined" : "changes_requested";
    const requestStatus = isApproved ? "godkjent" : type === "declined" ? "avslått" : "endringer ønsket";
    const timestampColumn = isApproved ? { approved_at: new Date().toISOString() } : isChangesRequested ? { changes_requested_at: new Date().toISOString() } : {};

    const { error: updateError } = await supabaseAdmin
      .from("requests")
      .update({ portal_status: portalStatus, status: requestStatus, ...timestampColumn })
      .eq("id", tokenRow.quote_id);

    if (updateError) {
      console.error("portal quote status update failed:", updateError);
      await supabaseAdmin.from("quote_notes").insert({ quote_id: tokenRow.quote_id, author_id: null, note: `[PORTAL ACTION] ${portalStatus}` });
    }

    const portalMessage = isApproved
      ? "Tilbudet er godkjent. Hansen IT tar kontakt for videre fremdrift."
      : String(message || "").trim();

    await supabaseAdmin.from("quote_messages").insert({
      quote_id: tokenRow.quote_id,
      author_type: "customer",
      author_name: "Kunde",
      message: portalMessage
    });

    await supabaseAdmin.from("quote_notes").insert({
      quote_id: tokenRow.quote_id,
      author_id: null,
      note: `[PORTAL] ${portalStatus}: ${portalMessage}`
    });

    return NextResponse.json({ ok: true, status: portalStatus });
  } catch (error) {
    console.error("portal action failed:", error);
    return NextResponse.json({ error: "Kunne ikke oppdatere portalstatus." }, { status: 500 });
  }
}
