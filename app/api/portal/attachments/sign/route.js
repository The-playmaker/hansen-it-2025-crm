import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { token, file_path } = await req.json();

    if (!token || !file_path) {
      return NextResponse.json({ error: "Missing token or file_path" }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    // Validate token -> get quote_id
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("quote_portal_tokens")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Expired token" }, { status: 410 });
    }

    // IMPORTANT: ensure the file belongs to that quote
    const { data: attachment, error: attErr } = await supabase
      .from("quote_attachments")
      .select("id, quote_id, file_path")
      .eq("file_path", file_path)
      .maybeSingle();

    if (attErr || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    if (String(attachment.quote_id) !== String(tokenRow.quote_id)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // Create signed URL
    const { data, error } = await supabase.storage
      .from("quote-attachments")
      .createSignedUrl(file_path, 60 * 10); // 10 min

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: "Could not sign url" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
