import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .select("*")
    .eq("quote_id", params.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(req, { params }) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from("quote-attachments")
    .upload(`${params.id}/${file.name}`, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .insert([
      {
        quote_id: params.id,
        file_name: file.name,
        file_path: uploadData.path,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
