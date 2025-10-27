"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
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
  }, [router]);

  return null;
}
