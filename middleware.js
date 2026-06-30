import { NextResponse } from "next/server";

export function middleware(req) {
  const isAuthenticated = Boolean(req.cookies.get("phoenixUser"));

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
