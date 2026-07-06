import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const storageBuckets = ["phoenix-documents", "quote-attachments", "quote-documents"];

async function createSignedUrl(filePath) {
  let lastError = null;
  for (const bucket of storageBuckets) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60 * 10);
    if (data?.signedUrl) return data.signedUrl;
    lastError = error;
  }
  throw lastError || new Error("Storage-path finnes ikke.");
}

export async function POST(req) {
  try {
    if (!hasSupabaseAdminConfig) {
      return NextResponse.json({ error: "Dokumentnedlasting er ikke konfigurert." }, { status: 503 });
    }

    const { token, file_path } = await req.json();

    if (!token || !file_path) {
      return NextResponse.json({ error: "Mangler token eller dokument." }, { status: 400 });
    }

    // Validate token -> get quote_id
    const { data: tokenRow, error: tokenErr } = await supabaseAdmin
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Ugyldig portal-lenke." }, { status: 404 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Portal-lenken er utløpt." }, { status: 410 });
    }

    // IMPORTANT: ensure the file belongs to that quote
    const { data: attachment, error: attErr } = await supabaseAdmin
      .from("quote_attachments")
      .select("id, quote_id, file_path")
      .eq("file_path", file_path)
      .maybeSingle();

    if (attErr || !attachment) {
      return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
    }

    if (String(attachment.quote_id) !== String(tokenRow.quote_id)) {
      return NextResponse.json({ error: "Du har ikke tilgang til dette dokumentet." }, { status: 403 });
    }

    return NextResponse.json({ url: await createSignedUrl(file_path) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Kunne ikke klargjøre nedlasting." }, { status: 500 });
  }
}
