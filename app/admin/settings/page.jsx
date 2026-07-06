"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { useMe } from "@/app/admin/useMe";

export default function SettingsIndex() {
  const { me, loading } = useMe();

  if (loading) return <div className="p-6 text-brand-300">Loading…</div>;
  if (!me) return <div className="p-6 text-brand-300">Not logged in</div>;

  // only admins (for now)
  if (!me.permissions?.includes("admin.settings.view") && me.role !== "admin") {
    return <div className="p-6 text-brand-300">No access</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="space-y-2">
            <div className="text-white font-semibold">Users</div>
            <div className="text-brand-300 text-sm">Assign roles to employees</div>
            <Link className="text-accent-blue underline text-sm" href="/admin/settings/users">
              Open
            </Link>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-white font-semibold">Roles</div>
            <div className="text-brand-300 text-sm">Create/edit roles + toggle permissions</div>
            <Link className="text-accent-blue underline text-sm" href="/admin/settings/roles">
              Open
            </Link>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-white font-semibold">Permissions</div>
            <div className="text-brand-300 text-sm">Create/edit permission keys</div>
            <Link className="text-accent-blue underline text-sm" href="/admin/settings/permissions">
              Open
            </Link>
          </div>
        </Card>

        <Card>
          <div className="space-y-2">
            <div className="text-white font-semibold">Data-opprydding</div>
            <div className="text-brand-300 text-sm">Rydd testdata og reset Ristesund testflyt med guardrails.</div>
            <Link className="text-accent-blue underline text-sm" href="/admin/settings/data-cleanup">
              Åpne
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
