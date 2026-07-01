import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CRM_CONTACT_ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(body, init = {}) {
  return NextResponse.json(body, { ...init, headers: { ...corsHeaders, ...(init.headers || {}) } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, key };
}

function normalizePayload(body) {
  return {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    company: String(body.company || "").trim(),
    message: String(body.message || "").trim(),
    category: String(body.category || "").trim(),
    source: String(body.source || "hansen-it-2025").trim()
  };
}

function isMissingTableError(error) {
  const text = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
  return text.includes("42p01") || text.includes("does not exist") || text.includes("relation") || text.includes("schema cache");
}

function shortMessage(message) {
  if (message.length <= 240) return message;
  return `${message.slice(0, 237)}...`;
}

async function notifySlack(payload, savedTarget, savedId) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const company = payload.company || "Ikke oppgitt";
  const phone = payload.phone || "Ikke oppgitt";
  const category = payload.category || "Ikke oppgitt";
  const source = payload.source || "hansen-it-2025";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Ny lead fra ${payload.name} (${company})`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Ny lead i Project Phoenix", emoji: true }
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Navn:*\n${payload.name}` },
              { type: "mrkdwn", text: `*Firma:*\n${company}` },
              { type: "mrkdwn", text: `*E-post:*\n${payload.email}` },
              { type: "mrkdwn", text: `*Telefon:*\n${phone}` },
              { type: "mrkdwn", text: `*Kategori:*\n${category}` },
              { type: "mrkdwn", text: `*Kilde:*\n${source}` }
            ]
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Melding:*\n${shortMessage(payload.message)}` }
          },
          {
            type: "context",
            elements: [{ type: "mrkdwn", text: `Lagret i ${savedTarget}${savedId ? ` (${savedId})` : ""}` }]
          }
        ]
      })
    });

    if (!response.ok) {
      console.error("Slack lead notification failed:", { status: response.status, statusText: response.statusText });
    }
  } catch (error) {
    console.error("Slack lead notification error:", error);
  }
}

export async function POST(request) {
  let payload;

  try {
    payload = normalizePayload(await request.json());
  } catch {
    return json({ status: "error", message: "Ugyldig JSON i forespørselen." }, { status: 400 });
  }

  if (!payload.name || !payload.email || !payload.message) {
    return json({ status: "error", message: "Navn, e-post og melding er påkrevd." }, { status: 400 });
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return json(
      { status: "error", message: "CRM er ikke koblet til database ennå. Prøv igjen senere eller kontakt post@hansen-it.com." },
      { status: 503 }
    );
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const leadRow = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    company: payload.company || null,
    message: payload.message,
    category: payload.category || null,
    source: payload.source || "hansen-it-2025",
    status: "ny"
  };

  const leadInsert = await supabase.from("phoenix_leads").insert(leadRow).select("id").single();

  if (!leadInsert.error) {
    await notifySlack(payload, "phoenix_leads", leadInsert.data?.id || null);
    return json({ status: "ok", message: "Takk! Henvendelsen er sendt til Hansen IT.", target: "phoenix_leads", id: leadInsert.data?.id || null });
  }

  if (!isMissingTableError(leadInsert.error)) {
    console.error("phoenix_leads insert error:", leadInsert.error);
    return json({ status: "error", message: "Kunne ikke lagre henvendelsen i CRM." }, { status: 500 });
  }

  const description = [
    payload.category ? `Kategori: ${payload.category}` : null,
    payload.phone ? `Telefon: ${payload.phone}` : null,
    payload.source ? `Kilde: ${payload.source}` : null,
    "",
    payload.message
  ].filter((line) => line !== null).join("\n");

  const requestInsert = await supabase
    .from("requests")
    .insert({
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      company: payload.company || null,
      description,
      message: payload.message,
      priority: "normal",
      status: "Ny"
    })
    .select("id")
    .single();

  if (requestInsert.error) {
    console.error("requests fallback insert error:", requestInsert.error);
    return json({ status: "error", message: "Kunne ikke lagre henvendelsen i CRM." }, { status: 500 });
  }

  await notifySlack(payload, "requests", requestInsert.data?.id || null);

  return json({ status: "ok", message: "Takk! Henvendelsen er sendt til Hansen IT.", target: "requests", id: requestInsert.data?.id || null });
}
