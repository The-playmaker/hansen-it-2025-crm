import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = cookies().get("casdoorUser");
  if (!c?.value) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  try {
    const user = JSON.parse(c.value);
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Bad session" }, { status: 401 });
  }
}
