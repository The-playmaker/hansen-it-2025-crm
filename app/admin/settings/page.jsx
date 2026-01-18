"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

const tabs = [
  { key: "users", label: "Brukere", href: "/admin/settings/users" },
  { key: "roles", label: "Roller & tilgang", href: "/admin/settings/roles" },
  { key: "general", label: "Generelt", href: "/admin/settings/general" },
  { key: "integrations", label: "Integrasjoner", href: "/admin/settings/integrations" },
];

export default function SettingsHome() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-brand-300">Administrasjon, tilgang og systeminnstillinger.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href}>
            <Card className="cursor-pointer hover:bg-brand-900/40 transition">
              <div className="space-y-1">
                <div className="text-white font-semibold">{t.label}</div>
                <div className="text-brand-400 text-sm">Åpne {t.label.toLowerCase()}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
