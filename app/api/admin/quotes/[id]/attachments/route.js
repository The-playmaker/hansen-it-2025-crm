import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const attachmentQuoteIds = [quote.id, quote.source_request_id].filter(Boolean);

  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .select("*")
    .in("quote_id", attachmentQuoteIds)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: documents } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("quote_id", quote.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data, documents: documents || [] });
}

export async function POST(req, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const isPdf = (file.type || "").includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
  const bucket = "quote-attachments";
  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from(bucket)
    .upload(`${quote.id}/${Date.now()}-${file.name}`, file);

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("quote_attachments")
    .insert([
      {
        quote_id: quote.id,
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
  if (isPdf) {
    const { data: documentData, error: documentError } = await supabaseAdmin
      .from("quote_documents")
      .insert({
        quote_id: quote.id,
        request_id: quote.source_request_id || null,
        customer_id: quote?.customer_id || null,
        type: file.name.toLowerCase().includes("security") ? "scan_combined_pdf" : "quote_pdf",
        title: file.name.toLowerCase().includes("security") ? "Samlet sikkerhetsrapport" : "Tilbud PDF",
        filename: file.name,
        mime_type: file.type || "application/pdf",
        storage_path: uploadData.path,
        is_portal_visible: false,
        visible_in_portal: false
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
