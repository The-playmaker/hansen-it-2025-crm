import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side auth helper.
 * - getUser() verifies the JWT with the auth server (required on the server).
 * - getSession() is still fetched for provider_token (e.g. Microsoft Graph).
 */
export async function getSessionServer() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userError || !userData?.user ? null : userData.user;

  // Session is only needed for provider_token / refresh_token — not for auth decisions.
  const { data: sessionData } = await supabase.auth.getSession();
  const session = user ? sessionData?.session ?? null : null;

  return { supabase, user, session };
}
