import { LayoutGrid, KanbanSquare, Calendar, Users, Settings } from "lucide-react";

export const adminRoutes = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid, permsAny: [] },
  { href: "/admin/kanban", label: "Kanban", icon: KanbanSquare, permsAny: ["view_all_requests"] },
  { href: "/admin/calendar", label: "Calendar", icon: Calendar, permsAny: ["view_all_requests"] },
  { href: "/admin/employees", label: "Team / Employees", icon: Users, permsAny: ["manage_users"] },
  { href: "/admin/services", label: "Services", icon: Settings, permsAny: ["manage_services"] },

  // Settings root + under
  { href: "/admin/settings", label: "Settings", icon: Settings, permsAny: ["manage_users", "manage_roles"] },
  { href: "/admin/settings/users", label: "Settings · Users", icon: Users, permsAny: ["manage_users"] },
  { href: "/admin/settings/roles", label: "Settings · Roles", icon: Settings, permsAny: ["manage_roles"] },
];
