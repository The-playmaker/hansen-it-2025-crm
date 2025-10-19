"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const path = window.location.pathname;

      if (!session && path.startsWith("/dashboard")) {
        router.push("/login");
      }
      if (session && path === "/login") {
        router.push("/dashboard");
      }
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const path = window.location.pathname;

      if (session && path === "/login") {
        router.push("/dashboard");
      } else if (!session && path.startsWith("/dashboard")) {
        router.push("/login");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  return null;
}
