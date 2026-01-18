"use client";

import { useMe } from "./useMe";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }) {
  const { me, loading } = useMe();

  return (
    <div className="flex min-h-screen bg-brand-950 text-white">
      <AdminSidebar me={me} loading={loading} />
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}
