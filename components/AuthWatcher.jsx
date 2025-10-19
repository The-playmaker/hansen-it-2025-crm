"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

export default function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    // Håndter redirect fra OAuth (fanger #access_token osv)
    supabase.auth
      .getSessionFromUrl({ storeSession: true })
      .then(({ data, error }) => {
        if (error) console.error("Auth redirect error:", error);
        if (data?.session) {
          console.log("✅ OAuth-session lagret:", data.session.user.email);
          router.replace("/dashboard"); // sender videre
        }
      })
      .catch(console.error);

    // Sjekk eksisterende session
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const path = window.location.pathname;

      if (!session && path.startsWith("/dashboard")) {
        router.push("/login");
      } else if (session && path === "/login") {
        router.push("/dashboard");
      }
    };

    checkSession();

    // Overvåk endringer (login/logout)
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
