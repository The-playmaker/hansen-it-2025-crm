import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { logAdminAudit } from "@/lib/adminAudit";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { mapRequestToLead, normalizeRequestPriority, toRequestStatus } from "@/lib/requestLeadMapping";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

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
  if (typeof body.display_name === "string") patch.display_name = body.display_name.trim() || null;
  if (typeof body.name === "string") patch.name = body.name.trim() || null;
  if (typeof body.company === "string") patch.company = body.company.trim() || null;
  if (typeof body.message === "string") patch.message = body.message.trim() || null;
  if (typeof body.notes === "string") patch.notes = body.notes.trim() || null;
  if (body.archive === true) {
    patch.archived_at = new Date().toISOString();
    patch.archived_by = auth.admin.id;
    patch.status = "arkivert";
  }

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

  await logAdminAudit(auth.admin, body.archive === true ? "request.archived" : "request.updated", {
    entityType: "request",
    entityId: params.id,
    metadata: patch
  });

  return NextResponse.json({ data, lead: mapRequestToLead(data) });
}
