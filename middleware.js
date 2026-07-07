import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { safeAdminUser } from "@/lib/auth/roles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

function redirectLogin(request, error) {
  const url = new URL("/login", request.url);
  url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  if (error) url.searchParams.set("error", error);
  return NextResponse.redirect(url);
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;
  const isAdminApi = pathname.startsWith("/api/admin");
  const requestHeaders = new Headers(request.headers);

  if (!supabaseUrl || !supabaseAnonKey) {
    return isAdminApi
      ? jsonError("Innlogging er ikke konfigurert.", 503)
      : redirectLogin(request, "not_configured");
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user || null;

  if (userError || !user) {
    return isAdminApi ? jsonError("Du må være innlogget.", 401) : redirectLogin(request);
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("id,email,name,role,is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active === false) {
    console.warn("Admin auth profile check failed", {
      userId: user.id,
      email: user.email,
      error: profileError?.message
    });
    return isAdminApi ? jsonError("Du har ikke tilgang til CRM.", 403) : redirectLogin(request, "forbidden");
  }

  const admin = safeAdminUser(user, profile);
  requestHeaders.set("x-phoenix-admin", encodeURIComponent(JSON.stringify(admin)));
  requestHeaders.set("x-phoenix-role", admin.role);
  requestHeaders.set("x-phoenix-user-id", admin.id);
  requestHeaders.set("x-phoenix-user-email", admin.email || "");

  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  response.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
  return finalResponse;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
