"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  KanbanSquare,
  Calendar,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  Globe,
} from "lucide-react";
import { useMe } from "@/app/admin/useMe";

const baseNav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/kanban", label: "Kanban", icon: KanbanSquare },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar },
  { href: "/admin/employees", label: "Team / Employees", icon: Users },
  { href: "/admin/services", label: "Services", icon: Settings },
];

export function AdminLayout({ children, title }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const [collapsed, setCollapsed] = useState(false);

  // build nav after me is available
  const nav = useMemo(() => {
  const items = [...baseNav];

  const perms = me?.permissions || [];
  const canSeeSettings = perms.includes("manage_roles") || perms.includes("manage_users");

  if (canSeeSettings) {
    items.push({ href: "/admin/settings", label: "Settings", icon: Settings });
  }

  return items;
}, [me]);


  useEffect(() => {
    const saved = localStorage.getItem("admin_sidebar_collapsed");
    if (saved) setCollapsed(saved === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem("admin_sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  const handleLogout = async () => {
  await fetch("/api/logout", { method: "POST" });
  router.push("/login");
};


  return (
    <div className="flex min-h-screen bg-brand-950 text-white">
      <aside
        className={`sticky top-0 h-screen border-r border-brand-800 bg-brand-900/50 backdrop-blur
        transition-all duration-200 ${collapsed ? "w-16" : "w-64"} hidden md:flex flex-col z-50`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-brand-800">
          <span
            className={`font-bold text-lg text-accent-blue truncate ${
              collapsed ? "opacity-0 w-0 overflow-hidden" : "w-auto"
            }`}
          >
            Admin
          </span>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-brand-400 hover:text-white transition"
            title={collapsed ? "Expand" : "Collapse"}
          >
            <ChevronLeft
              className={`h-5 w-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-colors ${
                  active
                    ? "bg-accent-blue/10 text-accent-blue"
                    : "text-brand-400 hover:bg-brand-800 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${
                    active ? "text-accent-blue" : "text-brand-500 group-hover:text-white"
                  }`}
                />
                <span
                  className={`transition-opacity duration-200 ${
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-800 space-y-1">
          <Link
            href="/"
            target="_blank"
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-400 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <Globe className="h-5 w-5 shrink-0 text-brand-500 group-hover:text-white" />
            <span
              className={`transition-opacity duration-200 ${
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
              }`}
            >
              View Site
            </span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-brand-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0 text-brand-500 group-hover:text-red-400" />
            <span
              className={`transition-opacity duration-200 ${
                collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
              }`}
            >
              Logout
            </span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
