import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSessionServer } from "@/lib/getSessionServer";

export const dynamic = "force-dynamic";

const storageBuckets = ["phoenix-documents", "quote-attachments", "quote-documents"];

async function createSignedUrl(filePath) {
  let lastError = null;
  for (const bucket of storageBuckets) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(filePath, 60);
    if (data?.signedUrl) return data.signedUrl;
    lastError = error;
  }
  throw lastError || new Error("Kunne ikke signere dokument.");
}

export async function POST(req, { params }) {
  const { user } = await getSessionServer();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { file_path } = await req.json();

  if (!file_path) {
    return NextResponse.json({ error: "No file path provided" }, { status: 400 });
  }

  try {
    return NextResponse.json({ url: await createSignedUrl(file_path) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Kunne ikke lage nedlastingslenke." }, { status: 500 });
  }
}
