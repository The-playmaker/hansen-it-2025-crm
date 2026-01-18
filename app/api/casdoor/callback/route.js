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
    // Hent access token
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID,
      client_secret: process.env.CASDOOR_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/casdoor/callback`
    });

    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/token`,
      { method: "POST", body: params }
    );

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Casdoor token error", tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // Hent brukerinfo
    const userRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/get-user-info?accessToken=${tokenData.access_token}`
    );

    const userInfo = await userRes.json();

    if (!userInfo || !userInfo.displayName || !userInfo.email) {
      console.error("Invalid userInfo from Casdoor", userInfo);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
    }

    // Sjekk Supabase for rolle
    const supabase = getSupabaseServer();
    let { data: user } = await supabase
      .from("employees")
      .select("*")
      .eq("email", userInfo.email)
      .single();

    if (!user) {
      // Opprett bruker hvis ikke eksisterer
      const { data } = await supabase
        .from("employees")
        .insert({
          name: userInfo.displayName || userInfo.name,
          email: userInfo.email,
          role: "worker" // default rolle
        })
        .select()
        .single();
      user = data;
    }

    // Sett cookie og redirect
    const response = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/dashboard`);
    response.cookies.set({
      name: "casdoorUser",
      value: JSON.stringify({
        name: user.name,
        email: user.email,
        role: user.role
      }),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    return response;
  } catch (err) {
    console.error("Failed to login", err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/login`);
  }
}
