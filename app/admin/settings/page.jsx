"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useMe } from "@/app/admin/useMe";

const roles = ["owner", "admin", "employee", "viewer"];

function Badge({ children, tone = "slate" }) {
  const tones = {
    cyan: "border-cyan-300/30 bg-cyan-400/10 text-cyan-100",
    green: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    slate: "border-white/10 bg-white/5 text-slate-200"
  };
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}>{children}</span>;
}

function SettingRow({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value || "-"}</p>
    </div>
  );
}

export default function SettingsIndex() {
  const { me } = useMe();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingProfileId, setSavingProfileId] = useState(null);

  const canManage = ["owner", "admin"].includes(me?.role);
  const isOwner = me?.role === "owner";

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke hente innstillinger.");
      setSettings(json);
    } catch (err) {
      setError(err.message || "Kunne ikke hente innstillinger.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) loadSettings();
    else setLoading(false);
  }, [canManage, loadSettings]);

  const updateProfile = async (profileId, patch) => {
    setSavingProfileId(profileId);
    try {
      const res = await fetch(`/api/admin/settings/profiles/${profileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Kunne ikke oppdatere bruker.");
      setSettings((prev) => ({
        ...prev,
        profiles: (prev?.profiles || []).map((profile) => profile.id === profileId ? json.data : profile)
      }));
    } catch (err) {
      alert(err.message || "Kunne ikke oppdatere bruker.");
    } finally {
      setSavingProfileId(null);
    }
  };

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  };

  if (!me) return <div className="p-6 text-slate-300">Innlogget bruker mangler adminprofil.</div>;
  if (!canManage) return <div className="p-6 text-slate-300">Du har ikke tilgang til innstillinger. Kontakt owner/admin.</div>;
  if (loading) return <div className="p-6 text-slate-300">Laster innstillinger...</div>;
  if (error) return <div className="p-6 text-rose-200">{error}</div>;

  const company = settings?.company || {};
  const portal = settings?.portal || {};
  const quote = settings?.quote || {};
  const scan = settings?.scan || {};
  const integrations = settings?.integrations || {};
  const system = settings?.system || {};

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Project Phoenix</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Innstillinger</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Adminprofiler, firmaoppsett, portalstandarder, integrasjoner og systemstatus.</p>
        </div>
        <Button variant="outline" onClick={logout}>Logg ut</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <h2 className="text-xl font-bold text-white">Min profil</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingRow label="Navn" value={me.name} />
            <SettingRow label="E-post" value={me.email} />
            <SettingRow label="Rolle" value={me.role} />
            <SettingRow label="Aktiv status" value={me.is_active === false ? "Inaktiv" : "Aktiv"} />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-white">Systemoversikt</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingRow label="Environment" value={system.vercelEnv || system.nodeEnv || "local"} />
            <SettingRow label="Git branch" value={system.gitBranch} />
            <SettingRow label="Supabase host" value={integrations.supabase?.host} />
            <SettingRow label="Service role" value={integrations.serviceRolePresent ? "Konfigurert" : "Mangler"} />
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">Brukere og roller</h2>
            <p className="mt-1 text-sm text-slate-400">Adminbrukere må opprettes i Supabase Auth først, deretter gis rolle her.</p>
          </div>
          <Badge tone="cyan">{settings?.profiles?.length || 0} profiler</Badge>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-2">Bruker</th><th>Navn</th><th>Rolle</th><th>Status</th><th>Opprettet</th><th className="text-right">Handling</th></tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {(settings?.profiles || []).map((profile) => (
                <tr key={profile.id} className="text-slate-200">
                  <td className="py-3">{profile.email}</td>
                  <td><Input value={profile.name || ""} onChange={(event) => setSettings((prev) => ({ ...prev, profiles: prev.profiles.map((item) => item.id === profile.id ? { ...item, name: event.target.value } : item) }))} /></td>
                  <td>
                    <select value={profile.role || "viewer"} onChange={(event) => updateProfile(profile.id, { role: event.target.value })} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-white">
                      {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td>{profile.is_active ? <Badge tone="green">Aktiv</Badge> : <Badge tone="amber">Inaktiv</Badge>}</td>
                  <td className="text-slate-400">{profile.created_at ? new Date(profile.created_at).toLocaleDateString("nb-NO") : "-"}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={savingProfileId === profile.id} onClick={() => updateProfile(profile.id, { name: profile.name || "" })}>Lagre</Button>
                      <Button size="sm" variant="secondary" disabled={savingProfileId === profile.id} onClick={() => updateProfile(profile.id, { is_active: !profile.is_active })}>{profile.is_active ? "Deaktiver" : "Aktiver"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-bold text-white">Firma / branding</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingRow label="Firmanavn" value={company.name} />
            <SettingRow label="Standard e-post" value={company.email} />
            <SettingRow label="Nettside" value={company.website} />
            <SettingRow label="Tagline" value={company.tagline} />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-white">Portal og tilbud</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingRow label="Token levetid" value={`${portal.defaultTokenDays || 30} dager`} />
            <SettingRow label="Synlige dokumenttyper" value={(portal.defaultVisibleDocumentTypes || []).join(", ")} />
            <SettingRow label="Tilbud gyldig" value={`${quote.defaultValidityDays || 30} dager`} />
            <SettingRow label="Standard MVA" value={`${quote.defaultVatRate || 25} %`} />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-white">Scan-innstillinger</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingRow label="Scanner mode" value={scan.scannerMode} />
            <SettingRow label="Aktiv scan" value={scan.activeScanEnabled ? "Aktivert" : "Deaktivert"} />
            <SettingRow label="Egress IP" value={scan.egressIp} />
            <SettingRow label="Scanner node" value={scan.scannerNodeName} />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-bold text-white">Integrasjoner</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={integrations.supabaseConfigured ? "green" : "amber"}>Supabase {integrations.supabaseConfigured ? "OK" : "mangler"}</Badge>
            <Badge tone={integrations.n8nWebhookConfigured ? "green" : "slate"}>n8n {integrations.n8nWebhookConfigured ? "OK" : "ikke satt"}</Badge>
            <Badge tone={integrations.slackWebhookConfigured ? "green" : "slate"}>Slack {integrations.slackWebhookConfigured ? "OK" : "via n8n/ikke satt"}</Badge>
            <Badge tone={integrations.resendConfigured ? "green" : "slate"}>Resend {integrations.resendConfigured ? "OK" : "ikke satt"}</Badge>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-bold text-white">Siste audit events</h2>
        <div className="mt-4 space-y-2">
          {(settings?.audit || []).length ? settings.audit.map((event) => (
            <div key={event.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-white">{event.action}</span>
                <span className="text-xs text-slate-500">{event.created_at ? new Date(event.created_at).toLocaleString("nb-NO") : ""}</span>
              </div>
              <p className="mt-1 text-slate-400">{event.actor_email || "system"} · {event.entity_type || "-"} {event.entity_id || ""}</p>
            </div>
          )) : <p className="text-sm text-slate-400">Ingen audit events ennå.</p>}
        </div>
      </Card>

      <Card className="border-rose-400/20">
        <h2 className="text-xl font-bold text-white">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-400">Kun owner/admin. Handlinger skal forhåndsvises og bekreftes før data arkiveres eller slettes.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/admin/settings/data-cleanup"><Button variant="danger">Testdata cleanup</Button></Link>
          <Button variant="outline" disabled={!isOwner}>Purge slettede dokumenter senere</Button>
        </div>
      </Card>
    </div>
  );
}
