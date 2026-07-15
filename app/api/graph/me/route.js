// app/api/graph/me/route.js
import { getSessionServer } from "@/lib/getSessionServer";

export async function GET() {
  const { user, session } = await getSessionServer();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const accessToken = session?.provider_token; // Supabase lagrer MS token her
  if (!accessToken) return new Response("No provider token", { status: 401 });

  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = await res.text();
  return new Response(body, { status: res.status, headers: { "Content-Type": "application/json" } });
}
