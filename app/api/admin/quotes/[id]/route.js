import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { logAdminAudit } from "@/lib/adminAudit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { quoteResolveResponse, resolveQuoteId } from "@/lib/quotes/resolveQuoteId";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminErrorResponse(auth);

  try {
    const data = await resolveQuoteId(params.id);
    return NextResponse.json({ data });
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }
}

export async function PATCH(req, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  const body = await req.json();
  let quote = null;
  try {
    quote = await resolveQuoteId(params.id);
  } catch (error) {
    const response = quoteResolveResponse(error);
    return NextResponse.json({ error: response.error }, { status: response.status });
  }

  const patch = { ...body, updated_at: new Date().toISOString() };
  if (body.archive === true) {
    patch.archived_at = new Date().toISOString();
    patch.archived_by = auth.admin.id;
    delete patch.archive;
  }

  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update(patch)
    .eq("id", quote.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Fant ikke tilbud." }, { status: error ? 500 : 404 });
  }

  await logAdminAudit(auth.admin, body.archive === true ? "quote.archived" : "quote.updated", {
    entityType: "quote",
    entityId: quote.id,
    metadata: patch
  });

  return NextResponse.json({ data });
}
