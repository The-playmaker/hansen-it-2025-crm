// app/admin/layout.jsx
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
