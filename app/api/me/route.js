import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentUser();

  if (!session.user) {
    return NextResponse.json(null, { status: 401 });
  }

  if (!session.admin) {
    return NextResponse.json({ error: "Du har ikke tilgang til CRM." }, { status: 403 });
  }

  return NextResponse.json(session.admin);
}
