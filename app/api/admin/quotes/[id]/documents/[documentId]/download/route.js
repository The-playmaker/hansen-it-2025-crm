import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

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
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const wantsJson = new URL(request.url).searchParams.get("json") === "1";
  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, request_id, filename, storage_path, external_url")
    .eq("id", params.documentId)
    .eq("quote_id", quote.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet for dette tilbudet." }, { status: 404 });
  }

  if (document.external_url) {
    if (wantsJson) return NextResponse.json({ url: document.external_url });
    return NextResponse.redirect(document.external_url, 302);
  }

  if (!document.storage_path) {
    return NextResponse.json({ error: "Dokumentet mangler storage_path eller ekstern URL." }, { status: 404 });
  }

  try {
    const signedUrl = await createSignedDocumentUrl(document);
    if (wantsJson) return NextResponse.json({ url: signedUrl });
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error("admin quote document signed url failed:", error);
    return NextResponse.json({ error: "Kunne ikke klargjøre dokumentnedlasting." }, { status: 500 });
  }
}
