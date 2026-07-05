import { NextResponse } from "next/server";
import { requireMe } from "@/lib/requireMe";
import { runPassiveScanJob } from "@/lib/scannerRunner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_request, { params }) {
  const me = requireMe();
  if (!me) return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });

  try {
    const result = await runPassiveScanJob(params.id);
    if (!result.ok) return NextResponse.json(result, { status: result.status || 500 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("manual passive scan job error:", error);
    return NextResponse.json({ error: "Kunne ikke kjøre passiv scan-jobb." }, { status: 500 });
  }
}
