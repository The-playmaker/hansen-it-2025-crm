'use client';
import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const STATUSES = ['Ny', 'Pågår', 'Fullført'];

export default function Kanban() {
  const authConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabase = useMemo(
    () => (authConfigured ? createSupabaseBrowserClient() : null),
    [authConfigured]
  );
  const [items, setItems] = useState([]);

  const fetchData = async () => {
    const res = await fetch('/api/requests');
    const json = await res.json();
    setItems(json.data || []);
  };
  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel('requests-kanban')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, payload => {
        const rec = payload.new || payload.old;
        setItems(prev => {
          if (payload.eventType === 'INSERT') return [rec, ...prev];
          if (payload.eventType === 'UPDATE') return prev.map(it => it.id === rec.id ? rec : it);
          if (payload.eventType === 'DELETE') return prev.filter(it => it.id !== rec.id);
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const cols = useMemo(() => {
    const map = Object.fromEntries(STATUSES.map(s => [s, []]));
    items.forEach(it => { map[it.status || 'Ny'].push(it); });
    return map;
  }, [items]);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    const id = draggableId;
    // Optimistic UI
    setItems(prev => prev.map(it => it.id === id ? { ...it, status: destination.droppableId } : it));
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: destination.droppableId }),
    });
  };

  return (
    <section className="container-default py-8">
      <h1 className="text-2xl font-semibold mb-6">Innboks (Kanban)</h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4">
          {STATUSES.map(status => (
            <Droppable droppableId={status} key={status}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="col">
                  <div className="card p-3">
                    <div className="font-semibold mb-2">{status}</div>
                    <div className="space-y-2">
                      {cols[status].map((it, idx) => (
                        <Draggable key={it.id} draggableId={it.id} index={idx}>
                          {(p) => (
                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="card p-3">
                              <div className="text-sm font-semibold">{it.name || '—'}</div>
                              <div className="text-xs text-white/70">{it.email}</div>
                              <div className="text-xs mt-2 line-clamp-4">{it.message}</div>
                              <div className="text-xs mt-2 opacity-70">Prioritet: {it.priority || 'normal'}</div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </section>
  );
}
