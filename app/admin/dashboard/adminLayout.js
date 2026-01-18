import { adminRoutes } from "@/app/admin/adminRoutes";

const nav = useMemo(() => {
  const perms = me?.permissions || [];
  return adminRoutes
    .filter((r) => {
      if (!r.permsAny?.length) return true;
      return r.permsAny.some((p) => perms.includes(p));
    })
    // optional: ikke vis under-items i sidebar hvis du vil
    .filter((r) => !r.href.startsWith("/admin/settings/") || r.href === "/admin/settings");
}, [me]);
