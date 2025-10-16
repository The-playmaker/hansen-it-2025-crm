export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, company, message, priority, id, status } = body;
    const url = process.env.TEAMS_WEBHOOK_URL;
    if (!url) return new Response(JSON.stringify({ error: 'TEAMS_WEBHOOK_URL not set' }), { status: 500 });

    const text = `🚨 *HAST* forespørsel fra **${name}** (${email})\n` +
                 (company ? `Firma: ${company}\n` : '') +
                 `Status: ${status || 'Ny'}\n` +
                 `Melding: ${message}\n\n` +
                 (id ? `[Åpne i Dashboard](${process.env.PUBLIC_DASHBOARD_URL || ''}/dashboard)` : '');

    const payload = { text };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: 'Teams webhook error', details: t }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
