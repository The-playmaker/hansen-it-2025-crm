import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasMinimumRole } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return adminErrorResponse(auth);

  let supabaseUrlHost = null;
  try {
    supabaseUrlHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;
  } catch {
    supabaseUrlHost = "invalid";
  }

  const role = auth.profile.role;
  const permissions = [
    "admin.read",
    hasMinimumRole(role, "employee") ? "crm.write" : null,
    hasMinimumRole(role, "employee") ? "quotes.write" : null,
    hasMinimumRole(role, "admin") ? "settings.manage" : null,
    hasMinimumRole(role, "admin") ? "documents.delete" : null,
    role === "owner" ? "danger.manage" : null
  ].filter(Boolean);

  return NextResponse.json({
    accessAllowed: true,
    permissions,
    environment: {
      supabaseUrlHost,
      appEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || "local",
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "true"
    },
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
