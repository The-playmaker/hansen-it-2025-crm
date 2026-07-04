import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { getOrCreateSecurityScanShare, getSecurityScanReport } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

function publicBaseUrl(request) {
  return process.env.NEXT_PUBLIC_CRM_PUBLIC_URL || new URL(request.url).origin;
}

export async function POST(request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  const reportResult = await getSecurityScanReport(params.id);
  if (reportResult.error || !reportResult.data) {
    return NextResponse.json({ error: reportResult.error || "Rapporten finnes ikke." }, { status: reportResult.configured === false ? 503 : 404 });
  }

  const shareResult = await getOrCreateSecurityScanShare(params.id, me);
  if (shareResult.error || !shareResult.data) {
    return NextResponse.json({ error: shareResult.error || "Kunne ikke lage delbar lenke." }, { status: shareResult.configured === false ? 503 : 500 });
  }

  const url = `${publicBaseUrl(request)}/portal/security-report/${shareResult.data.token}`;
  return NextResponse.json({ data: shareResult.data, url, reused: shareResult.reused === true });
}
