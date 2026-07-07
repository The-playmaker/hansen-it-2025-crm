import { NextResponse } from "next/server";
import { getClientIp, verifyTurnstileToken } from "@/lib/captcha/turnstile";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";

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
  return { configured: hasSupabaseAdminConfig };
}

function normalizePayload(body) {
  const priority = String(body.priority || "").trim().toLowerCase();
  return {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    company: String(body.company || "").trim(),
    message: String(body.message || "").trim(),
    category: String(body.category || "").trim(),
    source: String(body.source || "hansen-it-2025").trim(),
    priority: ["hast", "urgent", "high", "høy", "true"].includes(priority) ? "hast" : "normal",
    turnstileToken: String(body.turnstileToken || body.captchaToken || body["cf-turnstile-response"] || "").trim()
  };
}

function hasTrustedContactRelay(request) {
  const expectedSecret = process.env.CRM_CONTACT_RELAY_SECRET;
  const providedSecret = request.headers.get("x-phoenix-contact-secret");
  return Boolean(expectedSecret && providedSecret && providedSecret === expectedSecret);
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
  const priority = payload.priority === "hast" ? "Haster" : "Normal";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `Ny henvendelse fra ${payload.name} (${company})`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: "Ny henvendelse i Project Phoenix", emoji: true } },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Navn:*\n${payload.name}` },
              { type: "mrkdwn", text: `*Firma:*\n${company}` },
              { type: "mrkdwn", text: `*E-post:*\n${payload.email}` },
              { type: "mrkdwn", text: `*Telefon:*\n${phone}` },
              { type: "mrkdwn", text: `*Kategori:*\n${category}` },
              { type: "mrkdwn", text: `*Kilde:*\n${source}` },
              { type: "mrkdwn", text: `*Prioritet:*\n${priority}` }
            ]
          },
          { type: "section", text: { type: "mrkdwn", text: `*Melding:*\n${shortMessage(payload.message)}` } },
          { type: "context", elements: [{ type: "mrkdwn", text: `Lagret i ${savedTarget}${savedId ? ` (${savedId})` : ""}` }] }
        ]
      })
    });

    if (!response.ok) {
      console.error("Slack request notification failed:", { status: response.status, statusText: response.statusText });
    }
  } catch (error) {
    console.error("Slack request notification error:", error);
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

  if (!hasTrustedContactRelay(request)) {
    const captcha = await verifyTurnstileToken(payload.turnstileToken, { ip: getClientIp(request) });
    if (!captcha.ok) {
      return json({ status: "error", message: captcha.message }, { status: captcha.status || 400 });
    }
  }

  const { configured } = getSupabaseConfig();
  if (!configured) {
    return json(
      { status: "error", message: "CRM er ikke koblet til database ennå. Prøv igjen senere eller kontakt post@hansen-it.com." },
      { status: 503 }
    );
  }

  const description = [
    payload.category ? `Kategori: ${payload.category}` : null,
    `Prioritet: ${payload.priority === "hast" ? "Haster" : "Normal"}`,
    payload.phone ? `Telefon: ${payload.phone}` : null,
    payload.source ? `Kilde: ${payload.source}` : null,
    "",
    payload.message
  ].filter((line) => line !== null).join("\n");

  const { data, error } = await supabaseAdmin
    .from("requests")
    .insert({
      name: payload.name,
      email: payload.email,
      phone: payload.phone || null,
      company: payload.company || null,
      description,
      message: payload.message,
      priority: payload.priority,
      status: "ny"
    })
    .select("id")
    .single();

  if (error) {
    console.error("requests insert error:", error);
    return json({ status: "error", message: "Kunne ikke lagre henvendelsen i CRM." }, { status: 500 });
  }

  await notifySlack(payload, "requests", data?.id || null);

  return json({ status: "ok", message: "Takk! Henvendelsen er sendt til Hansen IT.", target: "requests", id: data?.id || null });
}
