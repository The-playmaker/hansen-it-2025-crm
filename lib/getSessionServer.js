import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function getSessionServer() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );
  const { data } = await supabase.auth.getSession();
  return { supabase, session: data?.session ?? null };
}
