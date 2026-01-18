import { NextResponse } from "next/server";
import sdkConfig from "@/lib/casdoorConfig";

export const dynamic = 'force-dynamic';

export async function GET(req) {
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
