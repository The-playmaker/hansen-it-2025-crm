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

    // 1) validate token
    const { data: tokenRow } = await supabase
      .from("quote_portal_tokens")
      .select("quote_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // 2) ensure attachment belongs to same quote
    const { data: att } = await supabase
      .from("quote_attachments")
      .select("id, quote_id, file_path, file_name")
      .eq("file_path", file_path)
      .maybeSingle();

    if (!att || att.quote_id !== tokenRow.quote_id) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // 3) signed url (1 time)
    const { data: signed, error } = await supabase.storage
      .from("quote-attachments")
      .createSignedUrl(file_path, 60 * 10); // 10 min

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ url: signed.signedUrl, file_name: att.file_name });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
