import { NextResponse } from "next/server";

export function middleware(req) {
  const casdoorUserCookie = req.cookies.get("casdoorUser");
  const isAuthenticated = casdoorUserCookie ? true : false;

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
