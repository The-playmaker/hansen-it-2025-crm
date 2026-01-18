import { NextResponse } from "next/server";

export async function GET(req) {
  const cookie = req.cookies.get("casdoorUser");
  if (!cookie) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = JSON.parse(cookie.value);
  return NextResponse.json(user);
}
