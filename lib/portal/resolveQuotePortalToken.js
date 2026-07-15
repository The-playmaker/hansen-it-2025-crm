import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Resolves a portal token to its quote.
 *
 * When the token's quote_id does not match quotes.id, we fall back via
 * quotes.source_request_id. That path exists ONLY for backward compatibility with
 * old portal links already sent to customers — not as part of the current data model.
 * Do not rely on it for new tokens.
 */
export class PortalTokenError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PortalTokenError";
    this.status = status;
  }
}

async function findTokenRow(token) {
  const tables = ["quote_portal_tokens", "quote_tokens"];

  for (const table of tables) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (data) return { tokenRow: data, tokenSource: table };

    if (error) {
      console.warn(`quote portal token lookup failed in ${table}:`, error.message || error);
    }
  }

  return { tokenRow: null, tokenSource: null };
}

async function findQuoteForTokenQuoteId(quoteId, tokenSource) {
  const direct = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (direct.data) return direct.data;

  if (direct.error) {
    console.warn("quote portal direct quote lookup failed:", direct.error.message || direct.error);
  }

  const viaRequest = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("source_request_id", quoteId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (viaRequest.data) {
    console.warn(
      "[resolveQuotePortalToken] source_request_id fallback used (legacy portal link). Prefer quotes.id going forward.",
      {
        tokenSource,
        requestId: quoteId,
        quoteId: viaRequest.data.id,
      }
    );
    return viaRequest.data;
  }

  if (viaRequest.error) {
    console.warn("quote portal source_request_id fallback failed:", viaRequest.error.message || viaRequest.error);
  }

  return null;
}

export async function resolveQuotePortalToken(token) {
  const cleanToken = String(token || "").trim();
  if (!cleanToken) {
    throw new PortalTokenError("Mangler portal-token.", 400);
  }

  const { tokenRow, tokenSource } = await findTokenRow(cleanToken);
  if (!tokenRow) {
    throw new PortalTokenError("Ugyldig portal-lenke.", 404);
  }

  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
    throw new PortalTokenError("Portal-lenken er utløpt.", 410);
  }

  if (!tokenRow.quote_id) {
    throw new PortalTokenError("Portal-lenken mangler tilbudskobling.", 404);
  }

  const quote = await findQuoteForTokenQuoteId(tokenRow.quote_id, tokenSource);
  if (!quote) {
    throw new PortalTokenError("Tilbudet ble ikke funnet.", 404);
  }

  const normalizedTokenRow = String(tokenRow.quote_id) === String(quote.id)
    ? tokenRow
    : { ...tokenRow, legacy_quote_id: tokenRow.quote_id, quote_id: quote.id };

  return {
    quote,
    tokenRow: normalizedTokenRow,
    tokenSource,
  };
}
