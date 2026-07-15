import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { logAdminAudit } from "@/lib/adminAudit";

export const dynamic = "force-dynamic";

const roles = new Set(["owner", "admin", "employee", "viewer"]);

export async function PATCH(request, { params }) {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);
  if (!hasSupabaseAdminConfig) return NextResponse.json({ error: "Supabase er ikke konfigurert." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const payload = {};
  if (typeof body.name === "string") payload.name = body.name.trim() || null;
  if (typeof body.email === "string") payload.email = body.email.trim();
  if (typeof body.role === "string" && roles.has(body.role)) payload.role = body.role;
  if (typeof body.is_active === "boolean") payload.is_active = body.is_active;
  payload.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("admin_profiles")
    .update(payload)
    .eq("id", params.id)
    .select("id,email,name,role,is_active,created_at,updated_at")
    .single();

  if (error) {
    console.error("admin profile update failed:", error);
    return NextResponse.json({ error: "Kunne ikke oppdatere brukerprofil." }, { status: 500 });
  }

  await logAdminAudit(auth.admin, "admin_profile.updated", { entityType: "admin_profile", entityId: params.id, metadata: payload });
  return NextResponse.json({ data });
}
