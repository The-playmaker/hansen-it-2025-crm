"use client";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid email profile offline_access User.Read Mail.Send",
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/admin/dashboard`,
      },
    });
  };

  return (
    <section className="container-default py-24">
      <h1 className="text-2xl font-semibold">Logg inn</h1>
      <p className="text-white/70 mt-2">Bruk Microsoft-kontoen din.</p>
      <button onClick={login} className="mt-6 px-5 py-2 bg-white text-black rounded">
        Logg inn med Microsoft
      </button>
    </section>
  );
}
