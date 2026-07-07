import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { logAdminAudit } from "@/lib/adminAudit";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

export const dynamic = "force-dynamic";

function clean(value) {
  return typeof value === "string" ? value.trim() : undefined;
}

async function getDocumentForQuote(quoteId, documentId) {
  const quote = await resolveQuoteId(quoteId);
  const { data: document, error } = await supabaseAdmin
    .from("quote_documents")
    .select("*")
    .eq("id", documentId)
    .eq("quote_id", quote.id)
    .is("deleted_at", null)
    .maybeSingle();

  return { quote, document, error };
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  let resolved;
  try {
    resolved = await getDocumentForQuote(params.id, params.documentId);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  if (resolved.error || !resolved.document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

  const patch = { updated_at: new Date().toISOString() };
  if (Object.prototype.hasOwnProperty.call(body, "is_portal_visible")) {
    const visible = Boolean(body.is_portal_visible);
    patch.is_portal_visible = visible;
    patch.visible_in_portal = visible;
  }
  if (clean(body.display_name) !== undefined) patch.display_name = clean(body.display_name) || null;
  if (clean(body.filename) !== undefined) patch.filename = clean(body.filename) || resolved.document.filename;
  if (clean(body.type) !== undefined) patch.type = clean(body.type) || "attachment";
  if (clean(body.title) !== undefined) patch.title = clean(body.title) || null;

  const { data, error } = await supabaseAdmin
    .from("quote_documents")
    .update(patch)
    .eq("id", params.documentId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Kunne ikke oppdatere dokumentet." }, { status: 500 });

  await logAdminAudit(auth.admin, "quote_document.updated", {
    entityType: "quote_document",
    entityId: params.documentId,
    metadata: { quote_id: resolved.quote.id, patch }
  });

  return NextResponse.json({ data });
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let resolved;
  try {
    resolved = await getDocumentForQuote(params.id, params.documentId);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  if (resolved.error || !resolved.document) {
    return NextResponse.json({ error: "Dokumentet ble ikke funnet." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("quote_documents")
    .update({
      deleted_at: now,
      deleted_by: auth.admin.id,
      is_portal_visible: false,
      visible_in_portal: false,
      updated_at: now
    })
    .eq("id", params.documentId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: "Kunne ikke slette dokumentkoblingen." }, { status: 500 });

  let storageDeleted = false;
  if (body.deleteStorageFile === true && resolved.document.storage_path) {
    const storage = await supabaseAdmin.storage.from("quote-attachments").remove([resolved.document.storage_path]);
    if (storage.error) {
      console.error("quote document storage delete failed:", storage.error);
    } else {
      storageDeleted = true;
    }
  }

  await logAdminAudit(auth.admin, "quote_document.deleted", {
    entityType: "quote_document",
    entityId: params.documentId,
    metadata: { quote_id: resolved.quote.id, storageDeleted, storage_path: resolved.document.storage_path || null }
  });

  return NextResponse.json({ data, storageDeleted });
}
