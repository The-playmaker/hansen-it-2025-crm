"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, KanbanSquare, Users, Settings, LogOut, ChevronLeft, FileText, Lightbulb, Sparkles, Inbox } from "lucide-react";
import { useMe } from "@/app/admin/useMe";

const baseNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/customers", label: "Kunder", icon: Users },
  { href: "/admin/kanban", label: "Oppgaver", icon: KanbanSquare },
  { href: "/admin/quotes", label: "Tilbud", icon: FileText },
  { href: "/admin/ideas", label: "Idebank", icon: Lightbulb }
];

export function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const [collapsed, setCollapsed] = useState(false);

  const nav = [...baseNav];
  if (me?.role === "admin") {
    nav.push({ href: "/admin/settings", label: "Innstillinger", icon: Settings });
  }

  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("admin_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      <aside className={`sticky top-0 z-50 hidden h-screen flex-col border-r border-white/10 bg-slate-950/90 backdrop-blur-xl transition-all duration-200 md:flex ${collapsed ? "w-16" : "w-72"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-4">
          <Link href="/admin/dashboard" className={`flex items-center gap-3 overflow-hidden ${collapsed ? "w-8" : "w-auto"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className={`${collapsed ? "hidden" : "block"}`}>
              <p className="text-sm font-bold leading-tight text-white">Project Phoenix</p>
              <p className="text-xs text-slate-400">Hansen IT CRM</p>
            </div>
          </Link>
          <button onClick={() => setCollapsed(!collapsed)} className="rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white" title={collapsed ? "Utvid" : "Minimer"}>
            <ChevronLeft className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${active ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:bg-white/10 hover:text-white"}`} title={item.label}>
                <Icon className="h-5 w-5 shrink-0" />
                <span className={`${collapsed ? "hidden" : "block"}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-400 hover:bg-rose-500/10 hover:text-rose-200" title="Logg ut">
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={`${collapsed ? "hidden" : "block"}`}>Logg ut</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 flex items-center gap-2 overflow-x-auto border-b border-white/10 bg-slate-950/90 px-3 py-3 backdrop-blur md:hidden">
          {baseNav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${active ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-slate-300"}`}>
                <Icon className="h-4 w-4" />{item.label}
              </Link>
            );
          })}
        </div>
        <main className="min-w-0 flex-1 overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,#020617,#0f172a)]">{children}</main>
      </div>
    </div>
  );
}
