import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { PortalTokenError, resolveQuotePortalToken } from "@/lib/portal/resolveQuotePortalToken";

export const dynamic = "force-dynamic";

async function createSignedDocumentUrl(document) {
  const { data, error } = await supabaseAdmin.storage
    .from("quote-attachments")
    .createSignedUrl(document.storage_path, 60 * 10, { download: document.filename || "dokument.pdf" });

  if (data?.signedUrl) return data.signedUrl;
  throw error || new Error("Storage object finnes ikke.");
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

  const wantsJson = new URL(request.url).searchParams.get("json") === "1";
  let resolved;
  try {
    resolved = await resolveQuotePortalToken(token);
  } catch (error) {
    if (error instanceof PortalTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("portal document token resolve failed:", error);
    return NextResponse.json({ error: "Kunne ikke apne dokumentet." }, { status: 500 });
  }

  const { quote, tokenSource } = resolved;
  const { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, filename, storage_path, external_url, is_portal_visible, visible_in_portal")
    .eq("id", documentId)
    .eq("quote_id", quote.id)
    .eq("is_portal_visible", true)
    .maybeSingle();

  if (documentError) {
    console.error("portal document query failed:", {
      tokenSource,
      quoteId: quote.id,
      documentId,
      error: documentError.message || documentError,
    });

    return NextResponse.json({
      error: wantsJson
        ? "Dokumentnedlasting feilet teknisk"
        : "Dokumentet kunne ikke apnes akkurat na. Kontakt Hansen IT.",
    }, { status: 500 });
  }

  if (!document) {
    const { count } = await supabaseAdmin
      .from("quote_documents")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id);

    console.warn("portal document not found", {
      tokenSource,
      quoteId: quote.id,
      documentId,
      documentCountForQuote: count ?? null,
      error: documentError?.message || null,
    });

    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

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
    return NextResponse.json({ error: "Dokumentet er ikke gjort tilgjengelig enna." }, { status: 404 });
  }

  try {
    const signedUrl = await createSignedDocumentUrl(document);
    if (wantsJson) return NextResponse.json({ url: signedUrl });
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("portal document signed url failed:", {
      quoteId: quote.id,
      documentId,
      storagePath: document.storage_path,
      bucket: "quote-attachments",
      error: error?.message || error,
    });
    return NextResponse.json({ error: "Dokumentet kunne ikke apnes akkurat na. Kontakt Hansen IT." }, { status: 500 });
  }
}
