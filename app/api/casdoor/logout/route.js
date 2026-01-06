import { NextResponse } from "next/server";
import sdkConfig from "@/lib/casdoorConfig";

export async function GET() {
  const response = NextResponse.redirect(`${sdkConfig.appUrl}/login`);

  response.cookies.set({
    name: "casdoorUser",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: -1,
  });

  return response;
}
