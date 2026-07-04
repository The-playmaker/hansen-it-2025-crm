import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { getOrCreateSecurityScanShare, getSecurityScanReport, logSecurityScanDelivery } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

function publicBaseUrl(request) {
  return process.env.NEXT_PUBLIC_CRM_PUBLIC_URL || new URL(request.url).origin;
}

function emailHtml({ report, url, message }) {
  const data = report.report || {};
  const actions = (data.actions || []).slice(0, 5);
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2>Phoenix Scan-rapport: ${report.domain}</h2>
      <p><strong>Score:</strong> ${report.score}/100 (${report.grade})</p>
      <p>${data.summary || "Rapporten er klar."}</p>
      ${message ? `<p>${String(message).replace(/\n/g, "<br>")}</p>` : ""}
      ${actions.length ? `<h3>Prioriterte tiltak</h3><ul>${actions.map((action) => `<li><strong>${action.title}</strong>: ${action.fix || action.explain || ""}</li>`).join("")}</ul>` : ""}
      <p><a href="${url}" style="display:inline-block;background:#22d3ee;color:#020617;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:bold">Åpne rapport</a></p>
      <p style="font-size:12px;color:#64748b">Lenken er personlig delt fra Hansen IT CRM og utløper automatisk.</p>
    </div>
  `;
}

async function sendWithResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, status: 503, error: "RESEND_API_KEY mangler. Kan ikke sende rapport fra server." };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.SCAN_REPORT_FROM || "Hansen IT <rapport@hansen-it.com>",
      to,
      subject,
      html
    })
  });

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, error: text || "Resend avviste e-posten." };
  }

  const data = await response.json().catch(() => ({}));
  return { ok: true, data };
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const recipientEmail = String(body.recipient_email || "").trim();
  if (!recipientEmail || !recipientEmail.includes("@")) {
    return NextResponse.json({ error: "Gyldig mottaker-e-post er påkrevd." }, { status: 400 });
  }

  const reportResult = await getSecurityScanReport(params.id);
  if (reportResult.error || !reportResult.data) {
    return NextResponse.json({ error: reportResult.error || "Rapporten finnes ikke." }, { status: reportResult.configured === false ? 503 : 404 });
  }

  const shareResult = await getOrCreateSecurityScanShare(params.id, me);
  if (shareResult.error || !shareResult.data) {
    return NextResponse.json({ error: shareResult.error || "Kunne ikke lage delbar lenke." }, { status: shareResult.configured === false ? 503 : 500 });
  }

  const url = `${publicBaseUrl(request)}/portal/security-report/${shareResult.data.token}`;
  const subject = String(body.subject || `Phoenix Scan-rapport: ${reportResult.data.domain}`).trim();
  const sendResult = await sendWithResend({
    to: recipientEmail,
    subject,
    html: emailHtml({ report: reportResult.data, url, message: body.message })
  });

  await logSecurityScanDelivery({
    report_id: params.id,
    share_id: shareResult.data.id,
    recipient_email: recipientEmail,
    subject,
    status: sendResult.ok ? "sent" : "failed",
    error: sendResult.ok ? null : sendResult.error,
    sent_at: sendResult.ok ? new Date().toISOString() : null
  });

  if (!sendResult.ok) {
    return NextResponse.json({ error: sendResult.error, url }, { status: sendResult.status || 500 });
  }

  return NextResponse.json({ ok: true, url, data: sendResult.data });
}
