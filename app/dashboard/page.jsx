'use client';
import { useEffect, useState } from 'react';
import { FiRefreshCw, FiLogOut } from 'react-icons/fi';
import { supabase } from '../../lib/supabaseClient';
import DetailModal from '../../components/DetailModal';

const STATUS = ['Ny', 'Pågår', 'Fullført'];
const PRIORITY_COLOR = { hast: 'border-red-400 text-red-300', normal: 'border-white/30 text-white/70' };

async function notifyTeamsIfHast(rec) {
  if ((rec?.priority || 'normal') !== 'hast') return;
  try {
    await fetch('/api/notify/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rec),
    });
  } catch {}
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [session, setSession] = useState(null);
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) window.location.href = '/login';
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

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

  useEffect(() => {
    const channel = supabase
      .channel('requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, async payload => {
        const rec = payload.new || payload.old;
        if (payload.eventType === 'INSERT') {
          setItems(prev => [rec, ...prev]);
          await notifyTeamsIfHast(rec); // alert on new HAST
        } else if (payload.eventType === 'UPDATE') {
          setItems(prev => prev.map(it => it.id === rec.id ? rec : it));
        } else if (payload.eventType === 'DELETE') {
          setItems(prev => prev.filter(it => it.id !== rec.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
      if (json?.data?.priority === 'hast') await notifyTeamsIfHast(json.data);
    } catch {
      alert('Feil ved oppdatering');
    } finally {
      setSavingId(null);
    }
  };

  const openDetail = (it) => { setSelected(it); setOpen(true); };
  const saveDetail = async (patch) => { if (selected) await updateItem(selected.id, patch); };

  return (
    <section className="container-default py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Innboks (Tabell)</h1>
        <div className="flex items-center gap-2">
          <a href="/dashboard/kanban" className="border border-white/20 rounded px-3 py-2 text-sm hover:bg-white/5">Kanban</a>
          <button onClick={() => window.location.href='/logout'} className="border border-white/20 rounded px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
            <FiLogOut /> Logg ut
          </button>
          <button onClick={fetchData} className="border border-white/20 rounded px-3 py-2 text-sm hover:bg-white/5 flex items-center gap-2">
            <FiRefreshCw /> Oppdater
          </button>
        </div>
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
                <tr key={it.id} className="border-t border-white/10 align-top hover:bg-white/5 cursor-pointer" onClick={() => openDetail(it)}>
                  <td className="py-3 pr-4">{new Date(it.created_at).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <div className="font-semibold">{it.name || '—'}</div>
                    <div className="text-white/70 whitespace-pre-wrap">{it.message || ''}</div>
                  </td>
                  <td className="py-3 pr-4">{it.email || '—'}</td>
                  <td className="py-3 pr-4">{it.company || '—'}</td>
                  <td className="py-3 pr-4"><span className={`badge ${PRIORITY_COLOR[(it.priority||'normal')]}`}>{it.priority || 'normal'}</span></td>
                  <td className="py-3 pr-4">
                    <select className="select" disabled={savingId === it.id} value={it.status || 'Ny'}
                      onChange={(e) => { e.stopPropagation(); updateItem(it.id, { status: e.target.value }); }}>
                      {['Ny','Pågår','Fullført'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="py-3 pr-4">
                    <input className="input" placeholder="Navn på ansvarlig" value={it.assigned_to || ''} disabled={savingId === it.id}
                      onClick={(e)=>e.stopPropagation()}
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

      <DetailModal open={open} onClose={()=>setOpen(false)} item={selected} onSave={saveDetail} />
    </section>
  );
}
