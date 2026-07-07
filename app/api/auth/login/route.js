import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const email = body.email || "post@hansen-it.com";
  const name = body.name || "Hansen IT Admin";

  if (!email) {
    return NextResponse.json({ error: "Feil e-post eller passord." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: "phoenixUser",
    value: JSON.stringify({ id: "phoenix-demo-user", name, email, role: "admin" }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  return response;
}
