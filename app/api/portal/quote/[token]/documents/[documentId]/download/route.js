import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const storageBuckets = ["quote-attachments", "quote-documents", "documents"];

async function createSignedDocumentUrl(document) {
  let lastError = null;
  for (const bucket of storageBuckets) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(document.storage_path, 60 * 10, { download: document.filename || "dokument.pdf" });
    if (data?.signedUrl) return data.signedUrl;
    lastError = error;
  }
  throw lastError || new Error("Storage-path finnes ikke.");
}

export async function GET(request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Dokumentnedlasting er ikke konfigurert." }, { status: 503 });
  }

  const token = String(params?.token || "");
  const documentId = String(params?.documentId || "");
  if (!token || !documentId) {
    return NextResponse.json({ error: "Mangler token eller dokument." }, { status: 400 });
  }

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("quote_id, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "Ugyldig portal-lenke." }, { status: 404 });
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    return NextResponse.json({ error: "Portal-lenken er utløpt." }, { status: 410 });
  }

  let { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, request_id, customer_id, filename, storage_path, visible_in_portal, is_portal_visible")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    const fallback = await supabaseAdmin
      .from("quote_documents")
      .select("id, quote_id, request_id, customer_id, filename, storage_path, visible_in_portal")
      .eq("id", documentId)
      .maybeSingle();
    document = fallback.data;
    documentError = fallback.error;
  }

  if (documentError || !document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

  const visible = document.is_portal_visible !== false && document.visible_in_portal !== false;
  const belongsToQuote = [document.quote_id, document.request_id].some((value) => String(value || "") === String(tokenRow.quote_id));
  if (!visible || !belongsToQuote) {
    return NextResponse.json({ error: "Du har ikke tilgang til dette dokumentet." }, { status: 403 });
  }

  try {
    const signedUrl = await createSignedDocumentUrl(document);
    if (new URL(request.url).searchParams.get("json") === "1") return NextResponse.json({ url: signedUrl });
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("portal document signed url failed:", error);
    return NextResponse.json({ error: "Kunne ikke klargjøre nedlasting." }, { status: 500 });
  }
}
