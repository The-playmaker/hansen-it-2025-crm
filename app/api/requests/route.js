import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

/**
 * Hent alle forespørsler (GET /api/requests)
 */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Feil ved henting av requests:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 200 });
}

/**
 * Opprett ny forespørsel (POST /api/requests)
 */
export async function POST(request) {
  try {
    const supabase = createSupabaseServerClient();
    const body = await request.json();
    const { name, email, company, message, priority = "normal" } = body;

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Mangler obligatoriske felt" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
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
