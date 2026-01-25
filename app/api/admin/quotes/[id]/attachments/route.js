import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(_req, ctx) {
  const quoteId = ctx.params.id;

  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .select("*")
    .eq("quote_id", quoteId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data || [] });
}

export async function POST(req, ctx) {
  const quoteId = ctx.params.id;

  const form = await req.formData();
  const file = form.get("file");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
  const path = `${quoteId}/${Date.now()}_${safeName}`;

  const up = await supabaseAdmin.storage
    .from("quote-attachments")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (up.error) {
    return NextResponse.json({ error: up.error.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .insert({
      quote_id: quoteId,
      file_name: safeName,
      file_path: path,
      uploaded_by: null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
