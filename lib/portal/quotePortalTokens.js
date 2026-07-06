import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getQuoteById(quoteId) {
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    throw new Error("Kunne ikke validere tilbudet.");
  }

  if (!data) {
    throw new Error("Portal token krever gyldig quote id");
  }

  return data;
}

export async function ensureQuotePortalToken(quoteId, { days = 30 } = {}) {
  const quote = await getQuoteById(quoteId);
  const now = new Date().toISOString();

  const existing = await supabaseAdmin
    .from("quote_portal_tokens")
    .select("*")
    .eq("quote_id", quote.id)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error("Kunne ikke sjekke eksisterende portal-token.");
  }

  if (existing.data) {
    return { data: existing.data, quote, reused: true };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { data, error } = await supabaseAdmin
    .from("quote_portal_tokens")
    .insert([{
      quote_id: quote.id,
      token: randomBytes(32).toString("hex"),
      expires_at: expiresAt.toISOString(),
    }])
    .select("*")
    .single();

  if (error) {
    console.error("ensure quote portal token failed:", {
      quoteId: quote.id,
      error: error.message || error,
    });
    throw new Error("Kunne ikke opprette portal-token.");
  }

  return { data, quote, reused: false };
}
