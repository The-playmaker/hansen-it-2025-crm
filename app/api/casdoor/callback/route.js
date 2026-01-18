import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }

  try {
    // 1) Exchange code -> access_token (Riktig Casdoor endpoint)
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID,
      client_secret: process.env.CASDOOR_CLIENT_SECRET,
      code,
      // Viktig: hold denne eksakt identisk med Casdoor app Redirect URI
      redirect_uri: "https://crm.hansen-it.com/api/casdoor/callback",
    });

    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        cache: "no-store",
      }
    );

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error("Invalid tokenData:", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // 2) Hent userinfo (Casdoor)
    // Mange Casdoor-oppsett bruker /api/get-account med accessToken
    const userRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/get-account?accessToken=${encodeURIComponent(
        tokenData.access_token
      )}`,
      { cache: "no-store" }
    );

    const userInfo = await userRes.json();

    // userInfo kan ha litt ulike feltnavn
    const email = userInfo?.email || userInfo?.mail;
    const displayName = userInfo?.displayName || userInfo?.name || userInfo?.username;

    if (!email || !displayName) {
      console.error("Invalid userInfo from Casdoor:", userInfo);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // 3) Sync/lookup i Supabase employees
    const supabase = getSupabaseServer();

    let { data: user } = await supabase
      .from("employees")
      .select("*")
      .eq("email", email)
      .single();

    if (!user) {
      const { data: created } = await supabase
        .from("employees")
        .insert({
          name: displayName,
          email,
          role: "worker",
        })
        .select()
        .single();

      user = created;
    }

    // 4) Sett cookie + redirect
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
