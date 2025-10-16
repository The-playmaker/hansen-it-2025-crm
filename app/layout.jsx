import './globals.css';
import Link from 'next/link';

"use client";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function RootLayout({ children }) {
  const router = useRouter();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push("/dashboard");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}


export const metadata = {
  title: 'Hansen IT – CRM Dashboard',
  description: 'Internt dashboard for henvendelser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-white/10 bg-black/40 backdrop-blur">
            <div className="container-default h-14 flex items-center justify-between">
              <div className="font-semibold">Hansen IT • CRM</div>
              <nav className="text-sm text-white/80 flex items-center gap-4">
                <Link href="/dashboard">Tabell</Link>
                <Link href="/dashboard/kanban">Kanban</Link>
                <Link href="/login">Logg inn</Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/10">
            <div className="container-default py-6 text-sm text-white/60">
              © {new Date().getFullYear()} Hansen IT
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
