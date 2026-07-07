import { NextResponse } from "next/server";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapRequestToLead, normalizeRequestPriority, toRequestStatus } from "@/lib/requestLeadMapping";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  if (!hasSupabaseAdminConfig) {
    return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });
  }

  const body = await request.json();
  const patch = {};

  if (body.status !== undefined) {
    const status = toRequestStatus(body.status);
    if (status === "converted") {
      return NextResponse.json({ error: "Bruk konverteringsendepunktet for å konvertere henvendelser. Statusfeltet settes ikke til converted." }, { status: 400 });
    }
    patch.status = status;
  }
  if (body.priority !== undefined) patch.priority = normalizeRequestPriority(body.priority);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Ingen støttede felt å oppdatere." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("requests")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) {
    console.error("requests update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, lead: mapRequestToLead(data) });
}
