"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    const handleOAuth = async () => {
      if (typeof window !== "undefined" && window.location.href.includes("code=")) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) console.error("Auth redirect error:", error);
          if (data?.session) router.replace("/dashboard");
        } catch (err) {
          console.error("exchangeCodeForSession error:", err);
        }
      }
    };
    handleOAuth();

    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      const path = window.location.pathname;
      if (!session && path.startsWith("/dashboard")) router.push("/login");
      else if (session && path === "/login") router.push("/dashboard");
    };
    sync();

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      const path = window.location.pathname;
      if (session && path === "/login") router.push("/dashboard");
      if (!session && path.startsWith("/dashboard")) router.push("/login");
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  return null;
}
