'use client';
import { supabase } from '../../lib/supabaseClient';

export default function LoginPage() {
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        scopes: 'email openid profile',
        redirectTo: "https://crm.hansen-it.com/dashboard",
      }
    });
  };

  return (
    <section className="container-default py-20">
      <h1 className="text-2xl font-semibold mb-4">Logg inn</h1>
      <p className="text-white/80 mb-6">Bruk Microsoft-kontoen din for å få tilgang til dashboardet.</p>
      <button onClick={login} className="btn">Logg inn med Microsoft</button>
    </section>
  );
}
