"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch("/api/logout", { method: "POST" }).finally(() => {
      router.replace("/login");
      router.refresh();
    });
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center shadow-card">
        <h1 className="text-xl font-bold">Logger ut...</h1>
        <p className="mt-2 text-sm text-slate-400">Phoenix-sessionen ryddes lokalt.</p>
      </div>
    </main>
  );
}
