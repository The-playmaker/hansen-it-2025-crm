"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Table, KanbanSquare, Mail, Users, Settings, LogOut, ChevronLeft
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Oversikt", icon: LayoutGrid },
  { href: "/dashboard/table", label: "Tabell", icon: Table },
  { href: "/dashboard/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/dashboard/inbox", label: "Inbox", icon: Mail },
  { href: "/dashboard/kunder", label: "Kunder", icon: Users },
  { href: "/dashboard/innstillinger", label: "Innstillinger", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Husk brukerens preferanse i localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);
  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={`h-screen sticky top-0 border-r border-white/10 bg-black/40 backdrop-blur
                  transition-all duration-200 ${collapsed ? "w-16" : "w-64"} hidden md:flex flex-col`}
    >
      <div className="h-14 px-3 flex items-center justify-between">
        <span className={`font-semibold truncate ${collapsed ? "opacity-0 pointer-events-none" : ""}`}>
          Hansen IT • CRM
        </span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-white/10 transition"
          title={collapsed ? "Utvid" : "Minimer"}
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className="px-2 py-2 space-y-1 overflow-auto">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded px-2 py-2 text-sm
                          hover:bg-white/10 transition
                          ${active ? "bg-white/10 text-white" : "text-white/80"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={`${collapsed ? "opacity-0 pointer-events-none" : "truncate"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-2">
        <Link
          href="/logout"
          className="flex items-center gap-3 rounded px-2 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          <span className={`${collapsed ? "opacity-0 pointer-events-none" : ""}`}>Logg ut</span>
        </Link>
      </div>
    </aside>
  );
}
