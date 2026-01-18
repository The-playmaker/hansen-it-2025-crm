import { adminRoutes } from "@/app/admin/adminRoutes";
import { AdminLayout } from "@/components/admin/AdminLayout";

const nav = [...baseNav];
if (me?.role === "admin") {
  nav.push({ href: "/admin/settings", label: "Settings", icon: Settings });
}


<div className="p-2 text-xs text-yellow-300">
  debug: {me ? `${me.email} (${me.role})` : "me=null"}
</div>

