import { supabaseAdmin } from "@/lib/supabaseAdmin";

export class QuoteResolveError extends Error {
  constructor(message = "Fant ikke tilbud for denne ID-en.", status = 404) {
    super(message);
    this.name = "QuoteResolveError";
    this.status = status;
  }
}

export async function resolveQuoteId(inputId) {
  const id = String(inputId || "").trim();
  if (!id) throw new QuoteResolveError("Mangler tilbuds-ID.", 400);

  const direct = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (direct.error) {
    console.error("resolveQuoteId direct lookup failed:", direct.error);
    throw new QuoteResolveError("Kunne ikke slå opp tilbudet.", 500);
  }

  if (direct.data) return direct.data;

  const viaRequest = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("source_request_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (viaRequest.error) {
    console.error("resolveQuoteId source_request_id lookup failed:", viaRequest.error);
    throw new QuoteResolveError("Kunne ikke slå opp tilbudet.", 500);
  }

  if (viaRequest.data) return viaRequest.data;

  throw new QuoteResolveError("Fant ikke tilbud for denne ID-en.", 404);
}

export function quoteResolveResponse(error) {
  const status = error instanceof QuoteResolveError ? error.status : 500;
  return {
    error: error?.message || "Kunne ikke slå opp tilbudet.",
    status,
  };
}
