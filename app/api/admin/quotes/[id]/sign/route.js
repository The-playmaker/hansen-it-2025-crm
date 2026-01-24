import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const { file_path } = await req.json();

  if (!file_path) {
    return NextResponse.json({ error: "No file path provided" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("quote-attachments")
    .createSignedUrl(file_path, 60);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
