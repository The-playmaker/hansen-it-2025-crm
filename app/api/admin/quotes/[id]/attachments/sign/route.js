import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  throw lastError || new Error("Kunne ikke signere dokument.");
}

export async function POST(req, ctx) {
  const { id } = ctx.params;
  const body = await req.json().catch(() => ({}));
  const file_path = body.file_path;

  if (!file_path) {
    return NextResponse.json({ error: "Missing file_path" }, { status: 400 });
  }

  // sikkerhet: sjekk at attachment faktisk tilhører quote id
  const { data: att, error: attErr } = await supabaseAdmin
    .from("quote_attachments")
    .select("id,quote_id,file_path")
    .eq("quote_id", id)
    .eq("file_path", file_path)
    .maybeSingle();

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });
  if (!att) return NextResponse.json({ error: "Not found / not allowed" }, { status: 404 });

  try {
    return NextResponse.json({ url: await createSignedUrl(file_path) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Kunne ikke lage nedlastingslenke." }, { status: 500 });
  }
}
