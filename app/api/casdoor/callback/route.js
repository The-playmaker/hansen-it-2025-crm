import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
const isCasdoorAdmin = !!account?.isAdmin || account?.tag === "admin";
const defaultRole = isCasdoorAdmin ? "admin" : "worker";

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }

  try {
    // 1) Exchange code -> access_token (Casdoor endpoint)
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID,
      client_secret: process.env.CASDOOR_CLIENT_SECRET,
      code,
      redirect_uri: "https://crm.hansen-it.com/api/casdoor/callback",
    });

    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/login/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        cache: "no-store",
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData?.access_token) {
      console.error("Invalid tokenData:", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // 2) Get account/userinfo
    const userRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/get-account?accessToken=${encodeURIComponent(
        tokenData.access_token
      )}`,
      { cache: "no-store" }
    );

    const userInfo = await userRes.json();

    const account = userInfo?.data; // Casdoor legger brukeren her
    const email = account?.email || account?.mail;
    const displayName =
      account?.displayName || account?.name || userInfo?.name || "Unknown";

    if (!email) {
      console.error("Invalid userInfo from Casdoor:", userInfo);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // 3) Sync/lookup in Supabase employees
    const supabase = getSupabaseServer();

    const { data: existingUser, error: findErr } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .maybeSingle(); // <-- viktig: gir null uten å kaste "error" ved 0 treff

    if (findErr) {
      console.error("Supabase lookup error:", findErr);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    let user = existingUser;

    if (!user) {
      const { data: created, error: createErr } = await supabase
        .from("employees")
        .insert({
          name: displayName,
          email,
          role: "worker",
        })
        .select()
        .single();

      if (createErr) {
        console.error("Supabase insert error:", createErr);
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
      }

      user = created;
    }

    // 4) Cookie + redirect
    const response = NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`
    );

    response.cookies.set({
      name: "casdoorUser",
      value: JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role,
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Failed to login:", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }
}
