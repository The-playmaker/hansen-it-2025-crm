import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMe } from "@/lib/requireMe";

export async function POST(req) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { file_path } = await req.json();
  if (!file_path) return NextResponse.json({ error: "Missing file_path" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.storage
    .from("quote-attachments")
    .createSignedUrl(file_path, 60); // 60s

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ url: data.signedUrl });
}
