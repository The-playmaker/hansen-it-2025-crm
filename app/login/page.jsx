"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "Hansen IT Admin", email: "post@hansen-it.com", password: "" });

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.session || data?.id || data?.email) router.replace("/admin/dashboard");
      })
      .catch(() => {});
  }, [router]);

  const startLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (!response.ok) throw new Error("Feil e-post eller passord.");
      router.push("/admin/dashboard");
      router.refresh();
    } catch (err) {
      setError(err?.message || "Feil e-post eller passord.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(63,161,255,0.18),transparent_34%),linear-gradient(135deg,#020617,#152149)] px-4 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div>
            <Image src="/brand/hansen-it/logo/logo-horizontal-dark.svg" alt="Hansen IT" width={300} height={90} priority className="mb-8 h-auto w-56 md:w-72" />
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <ShieldCheck size={16} /> Project Phoenix CRM
            </div>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Hansen IT CRM</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">Logg inn for å administrere kunder, tilbud, rapporter og leveranser.</p>
          </div>

          <form onSubmit={startLogin} className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 shadow-elevated backdrop-blur-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--hi-blue)] text-white">
              <LockKeyhole size={26} />
            </div>
            <h2 className="mt-6 text-2xl font-bold">Logg inn</h2>
            <p className="mt-2 text-sm text-slate-300">Tilgang er kun for autoriserte brukere.</p>
            <label className="mt-5 block text-sm font-medium text-slate-200">
              Navn
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-200">
              E-post
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-200">
              Passord
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 text-white outline-none focus:border-cyan-300" />
            </label>
            {error ? <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-100">{error}</div> : null}
            <button disabled={loading} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--hi-blue)] px-4 py-3 font-bold text-white hover:bg-[var(--hi-blue-light)] disabled:opacity-70">
              {loading ? "Logger inn..." : "Logg inn"}<ArrowRight size={18} />
            </button>
            <p className="mt-4 text-xs text-slate-500">Du blir sendt til dashboard etter innlogging.</p>
          </form>
        </div>
      </section>
    </main>
  );
}
