import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const id = params?.id;
  const body = await req.json().catch(() => ({}));
  const file_path = String(body.file_path || "");

  if (!id) return NextResponse.json({ error: "Missing quote id" }, { status: 400 });
  if (!file_path) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });

  // sikkerhet: sørg for at filen faktisk tilhører quote
  const { data: meta, error: metaErr } = await supabaseAdmin
    .from("quote_attachments")
    .select("id,quote_id,file_path")
    .eq("quote_id", id)
    .eq("file_path", file_path)
    .maybeSingle();

  if (metaErr) return NextResponse.json({ error: metaErr.message }, { status: 500 });
  if (!meta) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabaseAdmin.storage
    .from("quote-attachments")
    .createSignedUrl(file_path, 60 * 10); // 10 min

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data?.signedUrl });
}
