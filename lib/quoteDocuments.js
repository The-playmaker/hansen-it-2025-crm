import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getQuoteById } from "@/lib/portal/quotePortalTokens";

export function inferQuoteDocumentType(filename = "") {
  const lower = String(filename).toLowerCase();
  if (/(offer|quote|tilbud)/.test(lower)) return "quote_pdf";
  if (/(combined|samlet)/.test(lower) && /(security|scan|sikkerhet)/.test(lower)) return "scan_combined_pdf";
  if (/(security-report|security|scan|sikkerhet)/.test(lower)) return "scan_combined_pdf";
  return "attachment";
}

export function quoteDocumentTitle(type, filename = "") {
  if (type === "quote_pdf") return "Tilbud fra Hansen IT";
  if (type === "scan_combined_pdf") return "Samlet sikkerhetsrapport";
  if (type === "scan_domain_pdf") return `Teknisk rapport: ${String(filename).replace(/\.pdf$/i, "")}`;
  return filename || "Dokument";
}

export async function ensureQuoteDocumentFromAttachment({
  attachmentId,
  quoteId,
  requestId,
  customerId,
  isPortalVisible = true,
}) {
  const quote = await getQuoteById(quoteId);
  const { data: attachment, error: attachmentError } = await supabaseAdmin
    .from("quote_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();

  if (attachmentError || !attachment) {
    return { data: null, error: attachmentError || new Error("Fant ikke vedlegget.") };
  }

  const filename = attachment.file_name || attachment.filename || "dokument.pdf";
  const storagePath = attachment.file_path || attachment.storage_path;
  const type = inferQuoteDocumentType(filename);
  const effectiveRequestId =
    requestId ||
    quote.source_request_id ||
    (String(attachment.quote_id || "") !== String(quote.id || "") ? attachment.quote_id : null);
  const effectiveCustomerId = customerId || quote.customer_id || null;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("quote_id", quote.id)
    .eq("storage_path", storagePath)
    .maybeSingle();

  if (!existingError && existing) {
    const { data, error } = await supabaseAdmin
      .from("quote_documents")
      .update({
        request_id: existing.request_id || effectiveRequestId,
        customer_id: existing.customer_id || effectiveCustomerId,
        type: existing.type || type,
        title: existing.title || quoteDocumentTitle(type, filename),
        filename: existing.filename || filename,
        mime_type: existing.mime_type || "application/pdf",
        is_portal_visible: isPortalVisible,
        visible_in_portal: isPortalVisible,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return { data, error };
  }

  const { data, error } = await supabaseAdmin
    .from("quote_documents")
    .insert({
      quote_id: quote.id,
      request_id: effectiveRequestId,
      customer_id: effectiveCustomerId,
      type,
      title: quoteDocumentTitle(type, filename),
      filename,
      mime_type: attachment.mime_type || "application/pdf",
      storage_path: storagePath,
      is_portal_visible: isPortalVisible,
      visible_in_portal: isPortalVisible,
    })
    .select("*")
    .single();

  return { data, error };
}
