import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const storageBuckets = ["phoenix-documents", "quote-attachments", "quote-documents"];

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

  const { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, filename, storage_path, external_url, is_portal_visible")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

  if (String(document.quote_id) !== String(tokenRow.quote_id) || document.is_portal_visible !== true) {
    return NextResponse.json({ error: "Du har ikke tilgang til dette dokumentet." }, { status: 403 });
  }

  const wantsJson = new URL(request.url).searchParams.get("json") === "1";
  if (document.external_url) {
    let external = null;
    try {
      external = new URL(document.external_url);
    } catch {
      return NextResponse.json({ error: "Dokumentlenken er ugyldig." }, { status: 400 });
    }
    if (!["http:", "https:"].includes(external.protocol)) {
      return NextResponse.json({ error: "Dokumentlenken er ikke tillatt." }, { status: 403 });
    }
    if (wantsJson) return NextResponse.json({ url: document.external_url });
    return NextResponse.redirect(document.external_url, 302);
  }

  if (!document.storage_path) {
    return NextResponse.json({ error: "Dokumentet er ikke gjort tilgjengelig ennå." }, { status: 404 });
  }

  try {
    const signedUrl = await createSignedDocumentUrl(document);
    if (wantsJson) return NextResponse.json({ url: signedUrl });
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("portal document signed url failed:", error);
    return NextResponse.json({ error: "Dokumentet kunne ikke åpnes akkurat nå. Kontakt Hansen IT." }, { status: 500 });
  }
}
