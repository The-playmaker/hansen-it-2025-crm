import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  // 1) Bygg respons (redirect)
  const casdoorLogoutUrl =
    `${process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL}/logout` +
    `?redirect_uri=${encodeURIComponent(
      process.env.NEXT_PUBLIC_APP_URL + "/login"
    )}`;

  const response = NextResponse.redirect(casdoorLogoutUrl);

  // 2) Slett app-cookie
  response.cookies.set({
    name: "casdoorUser",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
