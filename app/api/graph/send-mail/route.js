// app/api/graph/send-mail/route.js
import { getSessionServer } from "@/lib/getSessionServer";

export async function POST(req) {
  const { user, session } = await getSessionServer();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const accessToken = session?.provider_token;
  if (!accessToken) return new Response("No provider token", { status: 401 });

  const { to, subject, body } = await req.json();

  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: body },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const t = await res.text();
    return new Response(t, { status: res.status });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
