"use client";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { clientSdkConfig } from "@/lib/casdoorConfig";

export default function LoginPage() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const startLogin = async () => {
    if (!clientSdkConfig.serverUrl || !clientSdkConfig.clientId) {
      setError("Casdoor-konfigurasjonen mangler. Legg inn miljøvariabler før SSO kan brukes.");
      return;
    }
    setLoading(true);
    const SdkModule = await import("casdoor-js-sdk");
    const Sdk = SdkModule.default;
    const sdk = new Sdk(clientSdkConfig);
    window.location.href = sdk.getSigninUrl();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (clientSdkConfig.serverUrl && clientSdkConfig.clientId) startLogin();
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#020617,#111827)] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <Sparkles size={16} /> Project Phoenix v1
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Hansen IT sitt operative CRM for dagens viktigste arbeid.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Dagens 3, kunder, oppgaver, tilbud og ideer samlet i én rolig dashboardflate. Bygget på eksisterende 2025 CRM-base.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-elevated backdrop-blur-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <ShieldCheck size={26} />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Logg inn</h2>
            <p className="mt-2 text-sm text-slate-300">Du sendes videre til sikker SSO. Hvis miljøvariabler mangler vises en tydelig konfigurasjonsfeil.</p>
            {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
            <button onClick={startLogin} disabled={loading} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-bold text-slate-950 hover:bg-cyan-300 disabled:opacity-70">
              {loading ? "Sender videre..." : "Fortsett med SSO"}<ArrowRight size={18} />
            </button>
            <p className="mt-4 text-xs text-slate-500">Phoenix v1 bruker eksisterende Casdoor-flyt. Ingen ny auth-stack er lagt til.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
