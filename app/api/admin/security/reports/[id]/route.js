import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { getSecurityScanReport } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const result = await getSecurityScanReport(params.id);
  if (result.error) return NextResponse.json(result, { status: result.data ? 500 : 404 });
  return NextResponse.json(result);
}
