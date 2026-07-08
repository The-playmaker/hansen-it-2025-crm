import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { logAdminAudit } from "@/lib/adminAudit";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSecurityScanReport } from "@/lib/securityScan/storage";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const auth = await requireAdmin();
  if (!auth.ok) return adminErrorResponse(auth);

  const result = await getSecurityScanReport(params.id);
  if (result.error) return NextResponse.json(result, { status: result.data ? 500 : 404 });
  return NextResponse.json(result);
}

export async function PATCH(request, { params }) {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const patch = { updated_at: new Date().toISOString() };
  if (typeof body.display_name === "string") patch.display_name = body.display_name.trim() || null;
  if (typeof body.title === "string") patch.title = body.title.trim() || null;
  if (typeof body.summary === "string") patch.summary = body.summary.trim() || null;
  if (typeof body.customer_summary === "string") patch.customer_summary = body.customer_summary.trim() || null;
  if (typeof body.internal_notes === "string") patch.internal_notes = body.internal_notes.trim() || null;
  if (body.archive === true) {
    patch.archived_at = new Date().toISOString();
    patch.archived_by = auth.admin.id;
  }

  const tables = ["scan_reports", "security_scan_reports"];
  let lastError = null;
  for (const table of tables) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq("id", params.id)
      .select("*")
      .maybeSingle();
    if (data) {
      await logAdminAudit(auth.admin, body.archive === true ? "scan_report.archived" : "scan_report.updated", {
        entityType: table,
        entityId: params.id,
        metadata: patch
      });
      return NextResponse.json({ data, source_table: table });
    }
    lastError = error || lastError;
  }

  if (lastError) console.error("scan report update failed:", lastError);
  return NextResponse.json({ error: "Rapporten ble ikke funnet." }, { status: 404 });
}
