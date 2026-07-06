import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { ensureQuoteDocumentFromAttachment } from "@/lib/quoteDocuments";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let { data: quote } = await supabaseAdmin
    .from("requests")
    .select("id, customer_id, source_request_id")
    .eq("id", params.id)
    .maybeSingle();

  if (!quote) {
    const fallback = await supabaseAdmin
      .from("quotes")
      .select("id, customer_id, source_request_id")
      .eq("id", params.id)
      .maybeSingle();
    quote = fallback.data;
  }

  const { data, error } = await ensureQuoteDocumentFromAttachment({
    attachmentId: params.attachmentId,
    quoteId: params.id,
    requestId: body.request_id || quote?.source_request_id || null,
    customerId: body.customer_id || quote?.customer_id || null,
    isPortalVisible: Boolean(body.is_portal_visible),
  });

  if (error || !data) {
    console.error("ensure quote document from attachment failed:", error);
    return NextResponse.json({ error: "Kunne ikke koble vedlegget til portalen." }, { status: 500 });
  }

  return NextResponse.json({ data });
}
