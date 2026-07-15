import { NextResponse } from "next/server";
import { requireAdmin, adminErrorResponse } from "@/lib/auth/requireAdmin";
import { getClientIp } from "@/lib/captcha/turnstile";
import { checkRateLimit } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Hent alle forespørsler (GET /api/requests)
 */
export async function GET() {
  const auth = await requireAdmin({ minRole: "employee" });
  if (!auth.ok) return adminErrorResponse(auth);

  const { data, error } = await supabaseAdmin
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Feil ved henting av requests:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, configured: true }, { status: 200 });
}

/**
 * Opprett ny forespørsel (POST /api/requests)
 */
export async function POST(request) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`requests:${clientIp || "unknown"}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!rateLimit.ok) {
      return NextResponse.json(
        { error: "For mange forespørsler. Prøv igjen om litt." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, company, message, priority = "normal" } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Mangler obligatoriske felt" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("requests")
      .insert([{ name, email, company, message, priority }])
      .select()
      .single();

    if (error) {
      console.error("Feil ved oppretting av request:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("Uventet feil:", err);
    return NextResponse.json({ error: "Intern feil" }, { status: 500 });
  }
}
