import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { PortalTokenError, resolveQuotePortalToken } from "@/lib/portal/resolveQuotePortalToken";

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

    const { quote } = await resolveQuotePortalToken(token);

    const { data: attachment, error: attErr } = await supabaseAdmin
      .from("quote_attachments")
      .select("id, quote_id, file_path")
      .eq("file_path", file_path)
      .maybeSingle();

    if (attErr || !attachment) {
      return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
    }

    const allowedQuoteIds = [quote.id, quote.source_request_id].filter(Boolean).map(String);
    if (!allowedQuoteIds.includes(String(attachment.quote_id))) {
      return NextResponse.json({ error: "Du har ikke tilgang til dette dokumentet." }, { status: 403 });
    }

    return NextResponse.json({ url: await createSignedUrl(file_path) });
  } catch (error) {
    if (error instanceof PortalTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("legacy portal attachment signed url failed:", error);
    return NextResponse.json({ error: "Kunne ikke klargjore nedlasting." }, { status: 500 });
  }
}
