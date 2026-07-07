import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { hasMinimumRole } from "@/lib/auth/roles";

export async function requireAdmin({ minRole = "viewer" } = {}) {
  const session = await getCurrentUser();

  if (!session.user) {
    return { ok: false, status: 401, error: "Du må være innlogget." };
  }

  if (!session.profile || session.profile.is_active === false) {
    return { ok: false, status: 403, error: "Du har ikke tilgang til CRM." };
  }

  if (!hasMinimumRole(session.profile.role, minRole)) {
    return { ok: false, status: 403, error: "Du har ikke tilgang til denne handlingen." };
  }

  return { ok: true, ...session };
}

export function adminErrorResponse(auth) {
  return NextResponse.json({ error: auth.error || "Du har ikke tilgang." }, { status: auth.status || 401 });
}
