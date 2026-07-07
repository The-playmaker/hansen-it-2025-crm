import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { hasSupabaseAdminConfig } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function maskSupabaseUrl(rawUrl) {
  if (!rawUrl) return null;

  try {
    const url = new URL(rawUrl);
    const hostParts = url.hostname.split(".");
    const projectRef = hostParts[0] || "";
    const maskedRef = projectRef.length > 8 ? `${projectRef.slice(0, 4)}...${projectRef.slice(-4)}` : projectRef;
    return {
      hostname: url.hostname,
      masked: `${url.protocol}//${maskedRef}.${hostParts.slice(1).join(".")}`
    };
  } catch {
    return { hostname: "Ugyldig URL", masked: "Ugyldig SUPABASE_URL" };
  }
}

export async function GET() {
  const auth = await requireAdmin({ minRole: "admin" });
  if (!auth.ok) return adminErrorResponse(auth);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  return NextResponse.json({
    configured: hasSupabaseAdminConfig,
    supabase: maskSupabaseUrl(supabaseUrl),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hint: "Bruk denne til å sjekke at Vercel peker mot samme Supabase-miljø som databasen du tester i. Service role key vises aldri."
  });
}
