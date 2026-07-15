import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { hasMinimumRole } from "@/lib/auth/roles";
import { listSecurityScanReports } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  if (!hasMinimumRole(me.role, "employee")) {
    return NextResponse.json({ error: "Du har ikke tilgang til denne handlingen." }, { status: 403 });
  }

  const result = await listSecurityScanReports();
  if (result.error) return NextResponse.json(result, { status: 500 });
  return NextResponse.json(result);
}
