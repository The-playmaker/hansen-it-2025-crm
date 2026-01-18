import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect("/login");
  }

  try {
    // Bytt code mot access token
    const params = new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID,
      client_secret: process.env.CASDOOR_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://crm.hansen-it.com/api/casdoor/callback"
    });

    const tokenRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/token`,
      { method: "POST", body: params }
    );

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      console.error("Casdoor token error", tokenData);
      return NextResponse.redirect("/login");
    }

    // Hent brukerinfo
    const userRes = await fetch(
      `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/api/get-user-info?accessToken=${tokenData.access_token}`
    );
    const userInfo = await userRes.json();

    // Lagre session i Supabase
    const supabase = getSupabaseServer();
    await supabase.from("sessions").upsert({
      user_id: userInfo.id,
      access_token: tokenData.access_token
    });

    // Sett cookie og redirect til dashboard
    const response = NextResponse.redirect("/admin/dashboard");
    response.cookies.set({
      name: "casdoorUser",
      value: JSON.stringify(userInfo),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/"
    });

    return response;
  } catch (err) {
    console.error("Failed to login", err);
    return NextResponse.redirect("/login");
  }
}
