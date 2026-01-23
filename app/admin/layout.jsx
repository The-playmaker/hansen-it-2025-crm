export const dynamic = "force-dynamic";
export const revalidate = 0;

import AdminShell from "@/components/admin/AdminShell.jsx";

export default function AdminRootLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
