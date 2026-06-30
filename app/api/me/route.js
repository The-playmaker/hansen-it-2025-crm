import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const cookie = req.cookies.get("phoenixUser")?.value;
  if (!cookie) return NextResponse.json(null, { status: 401 });

  try {
    return NextResponse.json(JSON.parse(cookie));
  } catch {
    return NextResponse.json(null, { status: 401 });
  }
}
