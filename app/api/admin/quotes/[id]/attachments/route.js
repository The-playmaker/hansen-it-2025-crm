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

  const { data: documents } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("quote_id", params.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data, documents: documents || [] });
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

  let document = null;
  if ((file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    const { data: quote } = await supabaseAdmin
      .from("requests")
      .select("id, customer_id")
      .eq("id", params.id)
      .maybeSingle();

    const { data: documentData, error: documentError } = await supabaseAdmin
      .from("quote_documents")
      .insert({
        quote_id: params.id,
        request_id: quote?.id || params.id,
        customer_id: quote?.customer_id || null,
        type: file.name.toLowerCase().includes("security") ? "security_report_pdf" : "quote_pdf",
        filename: file.name,
        mime_type: file.type || "application/pdf",
        storage_path: uploadData.path,
        visible_in_portal: true
      })
      .select("*")
      .single();

    if (documentError) {
      console.error("quote document registration failed:", documentError);
      return NextResponse.json({ error: "PDF ble lastet opp, men dokumentregistrering feilet. Kjor siste database-migration og prov igjen." }, { status: 500 });
    }
    document = documentData;
  }

  return NextResponse.json({ data, document });
}
