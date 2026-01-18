"use client";

import { useEffect, useState } from "react";

export default function SettingsOverview() {
  const [me, setMe] = useState(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setMe);
  }, []);

  if (!me) return <div className="p-6 text-brand-300">Loading…</div>;

  // IKKE legg React-komponenter (icons) inn i data-objekter her
  const routes = [
    { href: "/admin/dashboard", label: "Dashboard", requires: [] },
    { href: "/admin/employees", label: "Employees", requires: ["manage_users"] },
    { href: "/admin/settings/users", label: "Settings · Users", requires: ["manage_users"] },
    { href: "/admin/settings/roles", label: "Settings · Roles", requires: ["manage_roles"] },
  ];

  const hasAny = (req) => !req.length || req.some((p) => me.permissions?.includes(p) || me.role === "admin");

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold text-white">Settings · Overview</h1>
      <div className="text-brand-300">
        {me.name} · {me.email} · Rolle: {me.role}
      </div>

      <div className="space-y-2">
        {routes.map((r) => {
          const ok = hasAny(r.requires);
          return (
            <div
              key={r.href}
              className="flex items-center justify-between border border-brand-800 rounded p-3"
            >
              <div>
                <div className="text-white font-medium">{r.label}</div>
                <div className="text-xs text-brand-400">{r.href}</div>
                {!!r.requires.length && (
                  <div className="text-xs text-brand-400 mt-1">
                    Krever: {r.requires.join(", ")}
                  </div>
                )}
              </div>

              <div className={ok ? "text-emerald-400" : "text-red-400"}>
                {ok ? "✅ Tillatt" : "⛔ Ikke tillatt"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
