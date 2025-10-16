'use client';
import { useEffect, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

const STATUS = ['Ny', 'Pågår', 'Fullført'];
const PRIORITY_COLOR = { hast: 'border-red-400 text-red-300', normal: 'border-white/30 text-white/70' };

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests');
      const json = await res.json();
      setItems(json.data || []);
    } catch (e) {
      setError('Kunne ikke hente data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const updateItem = async (id, patch) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      setItems(prev => prev.map(it => it.id === id ? json.data : it));
    } catch {
      alert('Feil ved oppdatering');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section className="container-default py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Innboks</h1>
        <button onClick={fetchData} className="border border-white/20 rounded px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
          <FiRefreshCw /> Oppdater
        </button>
      </div>

      {loading && <p>Henter...</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70">
              <tr>
                <th className="text-left py-3 pr-4">Dato</th>
                <th className="text-left py-3 pr-4">Navn & Melding</th>
                <th className="text-left py-3 pr-4">E-post</th>
                <th className="text-left py-3 pr-4">Firma</th>
                <th className="text-left py-3 pr-4">Prioritet</th>
                <th className="text-left py-3 pr-4">Status</th>
                <th className="text-left py-3 pr-4">Tildelt</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-white/10 align-top">
                  <td className="py-3 pr-4">{new Date(it.created_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{it.name || '—'}</div>
                    <div className="text-white/70 whitespace-pre-wrap">{it.message || ''}</div>
                  </td>
                  <td className="py-3 pr-4">{it.email || '—'}</td>
                  <td className="py-3 pr-4">{it.company || '—'}</td>
                  <td className="py-3 pr-4">
                    <span className={`badge ${PRIORITY_COLOR[(it.priority||'normal')]}`}>{it.priority || 'normal'}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <select
                      className="select"
                      disabled={savingId === it.id}
                      value={it.status || 'Ny'}
                      onChange={(e) => updateItem(it.id, { status: e.target.value })}
                    >
                      {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <input
                      className="input"
                      placeholder="Navn på ansvarlig"
                      value={it.assigned_to || ''}
                      disabled={savingId === it.id}
                      onChange={(e) => updateItem(it.id, { assigned_to: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="text-white/70 mt-6">Ingen forespørsler ennå.</p>}
        </div>
      )}
    </section>
  );
}
