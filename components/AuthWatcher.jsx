"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuthRedirect = async () => {
      try {
        // Ny metode – bytter kode mot session etter Supabase redirect
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("Auth redirect error:", error);
        if (data?.session) {
          console.log("✅ Session lagret for:", data.session.user.email);
          router.replace("/dashboard");
        }
      } catch (err) {
        console.error(err);
      }
    };

    handleOAuthRedirect();

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const path = window.location.pathname;

      if (!session && path.startsWith("/dashboard")) router.push("/login");
      else if (session && path === "/login") router.push("/dashboard");
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const path = window.location.pathname;
      if (session && path === "/login") router.push("/dashboard");
      else if (!session && path.startsWith("/dashboard")) router.push("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  return null;
}
