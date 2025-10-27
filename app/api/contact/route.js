// app/api/contact/route.js
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, company, message, priority = "normal" } = body;
    if (!name || !email || !message)
      return new Response(JSON.stringify({ status: "error", message: "Mangler felt" }),
        { status: 400, headers: { "Content-Type": "application/json" } });

    const n8nWebhook = process.env.N8N_WEBHOOK_URL;
    const res = await fetch(n8nWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, company, message, priority }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("n8n feil:", t);
      return new Response(JSON.stringify({ status: "error", message: "Kunne ikke sende til n8n" }),
        { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ status: "ok", message: "Takk for din henvendelse!" }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Kontakt-API feil:", err);
    return new Response(JSON.stringify({ status: "error", message: "Intern feil" }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
