import { NextResponse } from "next/server";
import { getClientIp, verifyTurnstileToken } from "@/lib/captcha/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

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

async function notifyN8n(payload, savedTarget, savedId) {
  const webhookUrl = process.env.N8N_CONTACT_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) return;

  const company = payload.company || "Ikke oppgitt";
  const phone = payload.phone || "Ikke oppgitt";
  const category = payload.category || "Ikke oppgitt";
  const source = payload.source || "hansen-it-2025";
  const priorityLabel = payload.priority === "hast" ? "Haster" : "Normal";

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "phoenix.contact.created",
        target: savedTarget,
        id: savedId,
        savedAt: new Date().toISOString(),
        contact: {
          name: payload.name,
          company,
          email: payload.email,
          phone,
          category,
          source,
          priority: payload.priority,
          priorityLabel,
          message: payload.message,
          shortMessage: shortMessage(payload.message)
        },
        slack: {
          text: `Ny henvendelse fra ${payload.name} (${company})`,
          title: "Ny henvendelse i Project Phoenix"
        }
      })
    });

    if (!response.ok) {
      console.error("n8n contact notification failed:", { status: response.status, statusText: response.statusText });
    }
  } catch (error) {
    console.error("n8n contact notification error:", error);
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

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit(`contact:${clientIp || payload.email.toLowerCase()}`, { limit: 8, windowMs: 60_000 });
  if (!rateLimit.ok) {
    return json({ status: "error", message: "For mange innsendinger på kort tid. Prøv igjen om litt." }, { status: 429 });
  }

  if (!hasTrustedContactRelay(request)) {
    const captcha = await verifyTurnstileToken(payload.turnstileToken, { ip: clientIp });
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

  await notifyN8n(payload, "requests", data?.id || null);

  return json({ status: "ok", message: "Takk! Henvendelsen er sendt til Hansen IT.", target: "requests", id: data?.id || null });
}
