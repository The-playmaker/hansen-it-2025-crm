import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const cookie = req.cookies.get("casdoorUser")?.value;
  if (!cookie) return NextResponse.json(null, { status: 401 });

  try {
    const me = JSON.parse(cookie);
    return NextResponse.json(me);
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
