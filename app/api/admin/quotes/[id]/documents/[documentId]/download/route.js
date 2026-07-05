import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const { data: document, error: documentError } = await supabaseAdmin
    .from("quote_documents")
    .select("id, quote_id, filename, storage_path")
    .eq("id", params.documentId)
    .eq("quote_id", params.id)
    .maybeSingle();

  if (documentError || !document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet for dette tilbudet." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("quote-attachments")
    .createSignedUrl(document.storage_path, 60 * 10, { download: document.filename });

  if (error || !data?.signedUrl) {
    console.error("admin quote document signed url failed:", error);
    return NextResponse.json({ error: "Kunne ikke klargjøre dokumentnedlasting." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
