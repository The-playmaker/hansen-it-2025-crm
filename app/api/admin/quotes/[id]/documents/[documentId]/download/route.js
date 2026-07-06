import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
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
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const url = new URL(request.url);
  const wantsJson = url.searchParams.get("json") === "1";

  const { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, request_id, filename, storage_path")
    .eq("id", params.documentId)
    .maybeSingle();

  const belongsToQuote = document && [document.quote_id, document.request_id].some((value) => String(value || "") === String(params.id));
  if (documentError || !document || !belongsToQuote) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet for dette tilbudet." }, { status: 404 });
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
