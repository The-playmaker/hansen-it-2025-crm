"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthWatcher() {
  const router = useRouter();
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = useMemo(
    () => (authConfigured ? createSupabaseBrowserClient() : null),
    [authConfigured]
  );

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      if (typeof window !== "undefined" && window.location.href.includes("code=")) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (!error && data?.session) router.replace("/dashboard");
        } catch (e) {
          console.error(e);
        }
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      const path = window.location.pathname;
      if (session && path === "/login") router.push("/dashboard");
      if (!session && path.startsWith("/dashboard")) router.push("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router, supabase]);

  return null;
}
