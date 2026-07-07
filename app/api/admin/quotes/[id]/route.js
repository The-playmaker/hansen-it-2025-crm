import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
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

  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", quote.id)
    .select()
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Fant ikke tilbud." }, { status: error ? 500 : 404 });
  }

  return NextResponse.json({ data });
}
