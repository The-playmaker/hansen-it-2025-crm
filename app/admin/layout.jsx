export const dynamic = "force-dynamic";
export const revalidate = 0;

import AdminShell from "@/components/admin/AdminShell";

export default function AdminLayoutRoot({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
