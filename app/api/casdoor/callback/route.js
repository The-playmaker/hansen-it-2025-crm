import { NextResponse } from "next/server";
import Sdk from "casdoor-js-sdk";
import sdkConfig from "@/lib/casdoorConfig";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const casdoorSDK = new Sdk(sdkConfig);

  try {
    const { access_token } = await casdoorSDK.getAccessToken(code, state);
    const userInfo = await casdoorSDK.getUserInfo(access_token);

    const response = NextResponse.redirect(`${sdkConfig.appUrl}/admin/dashboard`);

    response.cookies.set({
      name: "casdoorUser",
      value: JSON.stringify(userInfo),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Failed to login", error);
    return NextResponse.redirect(`${sdkConfig.appUrl}/login`);
  }
}
