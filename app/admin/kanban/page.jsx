'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Flame, User, MapPin } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

const STATUS_COLUMNS = [
  { key: 'Ny',         title: 'New',        description: 'Nye henvendelser som ikke er påbegynt' },
  { key: 'Pågår',      title: 'In Progress', description: 'Jobber som er startet / under planlegging' },
  { key: 'Fullført',   title: 'Completed',   description: 'Ferdige jobber' },
];

export default function AdminBoard() {
  const [quotes, setQuotes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState(null);
  const router = useRouter();

  // Assuming current user context is handled via Supabase Auth, we can fetch it if needed for "onlyMine" filter
  const [currentUser, setCurrentUser] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
        setCurrentUser(data.user);
    });

    const load = async () => {
      try {
        setLoading(true);

        const [{ data: quotesData }, { data: employeesData }] = await Promise.all([
          supabase
            .from('requests') // Mapped from quotes to requests
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('employees')
            .select('*')
            .order('name', { ascending: true }),
        ]);

        setQuotes(quotesData || []);
        setEmployees(employeesData || []);
      } catch (err) {
        console.error('Error loading board data:', err);
      } finally {
        setLoading(false);
      }
    };

    load();

    const channel = supabase
      .channel('quotes-board-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDrop = async (quoteId, newStatus) => {
    setDraggingId(null);
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', quoteId);

      if (error) throw error;

      setQuotes((prev) =>
        prev.map((q) => (q.id === quoteId ? { ...q, status: newStatus } : q))
      );
    } catch (err) {
      console.error('Error updating quote status:', err);
    }
  };

  // Helper to find employee ID if current user is linked to an employee record
  const currentEmployeeId = employees.find(e => e.auth_user_id === currentUser?.id)?.id;

  const filteredQuotes = quotes.filter((q) => {
    if (onlyMine && currentEmployeeId) {
      return q.employee_id === currentEmployeeId;
    }
    return true;
  });

  const getColumnQuotes = (status) =>
    filteredQuotes.filter((q) => (q.status || 'Ny') === status);

  const getEmployeeName = (empId) => {
    const emp = employees.find((e) => e.id === empId);
    return emp ? emp.name : null;
  };

  return (
    <AdminLayout title="Kanban Board">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Job Board (Kanban)</h1>
            <p className="text-brand-400 text-sm">
              Dra og slipp jobber mellom kolonnene for å oppdatere status.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {currentEmployeeId && (
              <label className="inline-flex items-center gap-2 text-sm text-brand-300">
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) => setOnlyMine(e.target.checked)}
                  className="w-4 h-4 accent-accent-blue"
                />
                Show only my jobs
              </label>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {STATUS_COLUMNS.map((col) => {
              const colQuotes = getColumnQuotes(col.key);

              return (
                <Card
                  key={col.key}
                  className="flex flex-col bg-brand-900/60 border-brand-800 min-h-[300px]"
                  // React DnD logic or native drag/drop
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const idStr = e.dataTransfer.getData('text/plain');
                    if (idStr) {
                      handleDrop(idStr, col.key);
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                        {col.title}
                      </h2>
                      <p className="text-[11px] text-brand-500">{col.description}</p>
                    </div>
                    <span className="text-xs text-brand-400 bg-brand-800 px-2 py-1 rounded-full">
                      {colQuotes.length}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col gap-3 mt-2">
                    {colQuotes.length === 0 ? (
                      <div className="border border-dashed border-brand-800 rounded-xl py-6 text-center text-brand-600 text-xs">
                        Drop jobs here
                      </div>
                    ) : (
                      colQuotes.map((q) => {
                        const assigned = getEmployeeName(q.employee_id);
                        return (
                          <div
                            key={q.id}
                            draggable
                            onDragStart={(e) => {
                              setDraggingId(q.id);
                              e.dataTransfer.setData('text/plain', String(q.id));
                            }}
                            onDragEnd={() => setDraggingId(null)}
                            className={`border rounded-xl p-3 bg-brand-900/90 hover:bg-brand-800/90 cursor-move transition-all ${
                              draggingId === q.id
                                ? 'opacity-50 border-accent-blue'
                                : 'border-brand-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-white truncate">
                                {q.name || 'No Name'}
                              </h3>
                              {(q.priority === 'hast') && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                  <Flame className="w-3 h-3" />
                                  Urgent
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-brand-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {q.address || 'No address'}
                            </p>

                            {assigned && (
                              <p className="text-[11px] text-brand-400 flex items-center gap-1 mt-1">
                                <User className="w-3 h-3" />
                                {assigned}
                              </p>
                            )}

                            <p className="text-[11px] text-brand-500 mt-1 line-clamp-2">
                              {q.message}
                            </p>

                            <div className="flex items-center justify-between mt-2">
                              <span className="text-[10px] text-brand-500">
                                {q.created_at
                                  ? new Date(q.created_at).toLocaleDateString()
                                  : ''}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm" // Changed from xs to sm because xs wasn't defined in Button.jsx
                                onClick={() => router.push(`/admin/quote/${q.id}`)}
                                className="text-[11px] px-2 py-1 h-auto min-h-0"
                              >
                                Details
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
