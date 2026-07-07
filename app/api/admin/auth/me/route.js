import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return adminErrorResponse(auth);

  return NextResponse.json({
    user: {
      id: auth.user.id,
      email: auth.user.email
    },
    profile: {
      id: auth.profile.id,
      email: auth.profile.email,
      name: auth.profile.name,
      role: auth.profile.role,
      is_active: auth.profile.is_active
    },
    admin: auth.admin
  });
}
