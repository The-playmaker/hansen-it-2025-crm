"use client";

import { useEffect, useMemo, useState } from "react";
import { SecondaryButton } from "@/components/phoenix/PhoenixUi";

/**
 * Simple search-and-pick modal for linking CRM entities (customer / request).
 */
export default function CrmLinkPicker({
  open,
  title,
  description,
  items = [],
  loading = false,
  error = "",
  searchKeys = ["name"],
  labelFor = (item) => item.name || item.id,
  detailFor = () => "",
  onSelect,
  onClose,
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 40);
    return items
      .filter((item) =>
        searchKeys.some((key) => String(item?.[key] || "").toLowerCase().includes(needle))
      )
      .slice(0, 40);
  }, [items, query, searchKeys]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
          </div>
          <SecondaryButton type="button" onClick={onClose}>Lukk</SecondaryButton>
        </div>

        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søk..."
          className="mt-4 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none ring-cyan-400/40 focus:ring"
        />

        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        {loading ? <p className="mt-3 text-sm text-slate-400">Henter...</p> : null}

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {!loading && !filtered.length ? (
            <p className="text-sm text-slate-400">Ingen treff.</p>
          ) : null}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/45 px-3 py-2 text-left hover:border-cyan-400/40 hover:bg-slate-950/80"
            >
              <p className="font-semibold text-white">{labelFor(item)}</p>
              {detailFor(item) ? <p className="mt-0.5 text-xs text-slate-400">{detailFor(item)}</p> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
