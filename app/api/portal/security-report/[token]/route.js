import { NextResponse } from "next/server";
import { getSecurityScanReportByToken } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const result = await getSecurityScanReportByToken(params.token);
  if (result.error || !result.data) {
    return NextResponse.json({ error: result.error || "Rapporten finnes ikke." }, { status: result.expired ? 410 : result.configured === false ? 503 : 404 });
  }

  return NextResponse.json({ data: result.data });
}
