import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasSupabaseAdminConfig } from "@/lib/supabaseAdmin";
import { ensureQuoteDocumentFromAttachment } from "@/lib/quoteDocuments";
import { ensureQuotePortalToken, getQuoteById } from "@/lib/portal/quotePortalTokens";

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  let quote = null;
  try {
    quote = await getQuoteById(params.id);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Portal krever gyldig quote id." }, { status: 400 });
  }

  let data = null;
  let error = null;
  try {
    const result = await ensureQuoteDocumentFromAttachment({
      attachmentId: params.attachmentId,
      quoteId: quote.id,
      requestId: body.request_id || quote?.source_request_id || null,
      customerId: body.customer_id || quote?.customer_id || null,
      isPortalVisible: body.is_portal_visible !== false,
    });
    data = result.data;
    error = result.error;
  } catch (caughtError) {
    error = caughtError;
  }

  if (error || !data) {
    console.error("ensure quote document from attachment failed:", error);
    return NextResponse.json({ error: "Kunne ikke koble vedlegget til portalen." }, { status: 500 });
  }

  let portalToken = null;
  try {
    const tokenResult = await ensureQuotePortalToken(quote.id);
    portalToken = tokenResult.data;
  } catch (error) {
    console.error("ensure portal token after linking attachment failed:", error);
  }

  return NextResponse.json({ data, portalToken });
}
