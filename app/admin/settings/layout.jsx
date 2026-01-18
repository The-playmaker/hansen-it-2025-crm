"use client";

import { useMe } from "@/app/admin/useMe";

export default function SettingsLayout({ children }) {
  const { me, loading } = useMe();

  if (loading) return <div className="p-6 text-brand-300">Loading…</div>;
  if (!me) return <div className="p-6 text-red-400">Not logged in</div>;
  if (me.role !== "admin") return <div className="p-6 text-red-400">No access</div>;

  return <>{children}</>;
}
