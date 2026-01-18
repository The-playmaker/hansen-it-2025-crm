import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const c = cookies().get("casdoorUser");
  if (!c?.value) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  let sessionUser;
  try {
    sessionUser = JSON.parse(c.value);
  } catch {
    return NextResponse.json({ error: "Bad session" }, { status: 401 });
  }

  const supabase = getSupabaseServer();

  // get employee from your employees table
  const { data: employee } = await supabase
    .from("employees")
    .select("name,email,role")
    .eq("email", sessionUser.email)
    .maybeSingle();

  const roleName = employee?.role || sessionUser.role || "worker";

  // fetch role id
  const { data: roleRow } = await supabase
    .from("roles")
    .select("id,name")
    .eq("name", roleName)
    .maybeSingle();

  let permissions = [];
  if (roleRow?.id) {
    // join -> permissions keys
    const { data: rp } = await supabase
      .from("role_permissions")
      .select("permission_id, permissions:key ( key )")
      .eq("role_id", roleRow.id);

    // Supabase can return nested; safe parse:
    permissions = (rp || [])
      .map((x) => x?.permissions?.key)
      .filter(Boolean);
  }

  return NextResponse.json({
    name: employee?.name || sessionUser.name,
    email: employee?.email || sessionUser.email,
    role: roleName,
    permissions,
  });
}
