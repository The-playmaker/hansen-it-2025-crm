import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const cookie = req.cookies.get("casdoorUser")?.value;
    if (!cookie) return NextResponse.json(null, { status: 200 });

    const parsed = JSON.parse(cookie);
    const email = parsed?.email;
    if (!email) return NextResponse.json(null, { status: 200 });

    const supabase = getSupabaseServer();

    // employee
    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .select("id,name,email,role")
      .eq("email", email)
      .single();

    if (empErr || !emp) return NextResponse.json(null, { status: 200 });

    // roles for employee
    const { data: er, error: erErr } = await supabase
      .from("employee_roles")
      .select("role_id, roles:role_id (id,name)")
      .eq("employee_id", emp.id);

    const roles = (erErr ? [] : (er || []))
      .map((x) => x.roles?.name)
      .filter(Boolean);

    // permissions via roles
    let permissions = [];
    if ((er || []).length) {
      const roleIds = er.map((x) => x.role_id).filter(Boolean);

      const { data: rp, error: rpErr } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions:permission_id (key)")
        .in("role_id", roleIds);

      permissions = (rpErr ? [] : (rp || []))
        .map((x) => x.permissions?.key)
        .filter(Boolean);
    }

    // fallback: hvis du ikke har migrert alt ennå
    const effectiveRole = emp.role || (roles.includes("admin") ? "admin" : roles[0] || "worker");

    return NextResponse.json({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role: effectiveRole, // bakoverkompatibel
      roles: roles.length ? roles : [effectiveRole],
      permissions,
    });
  } catch (e) {
    console.error("api/me error:", e);
    return NextResponse.json(null, { status: 200 });
  }
}
