import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PUT(req, { params }) {
  const auth = await requireAdmin({ minRole: "owner" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabase = supabaseAdmin;
  const roleId = params.roleId;
  const { permissionIds } = await req.json(); // array of permission UUIDs

  if (!Array.isArray(permissionIds)) {
    return NextResponse.json({ error: "permissionIds must be an array" }, { status: 400 });
  }

  // Replace set: delete existing then insert new
  const { error: delErr } = await supabase
    .from("role_permissions")
    .delete()
    .eq("role_id", roleId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (permissionIds.length) {
    const rows = permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
    const { error: insErr } = await supabase.from("role_permissions").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
