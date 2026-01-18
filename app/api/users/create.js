import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req, res) {
  try {
    const body = await req.json();
    const { name, email, role, password } = body;

    const supabase = getSupabaseServer();

    // Sjekk om bruker finnes
    const { data: existing } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .single();

    if (existing) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Opprett i Supabase
    const { data: user } = await supabase
      .from("employees")
      .insert({ name, email, role })
      .select()
      .single();

    // Opprett i Casdoor
    const params = new URLSearchParams({
      owner: process.env.CASDOOR_ORG_NAME,
      name: email,
      email,
      password: password || "Temp123!",
      displayName: name,
      role,
      avatar: ""
    });

    const casdoorRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/add-user`,
      { method: "POST", body: params }
    );

    const casdoorData = await casdoorRes.json();

    if (casdoorData.error) {
      // Rull tilbake Supabase hvis Casdoor feil
