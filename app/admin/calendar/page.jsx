'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar as CalendarIcon, Clock, User, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminCalendar() {
  const [quotes, setQuotes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [{ data: quotesData }, { data: employeesData }] = await Promise.all([
          supabase
            .from('requests')
            .select('*')
            // Filter where at least one date is set
            .or('inspection_date.neq.null,start_date.neq.null,due_date.neq.null')
            .order('inspection_date', { ascending: true }),
          supabase
            .from('employees')
            .select('*')
            .order('name', { ascending: true }),
        ]);

        const q = quotesData || [];
        setQuotes(q);
        setEmployees(employeesData || []);

        const evts = [];

        const getEmpName = (empId) => {
          const e = employeesData?.find((x) => x.id === empId);
          return e ? e.name : null;
        };

        for (const quote of q) {
          const empName = getEmpName(quote.employee_id);

          if (quote.inspection_date) {
            evts.push({
              id: `insp-${quote.id}`,
              quote_id: quote.id,
              type: 'inspection',
              date: quote.inspection_date,
              label: 'Inspection',
              customer_name: quote.name, // mapped from customer_name to name
              address: quote.address,
              employee_name: empName,
              urgent: quote.priority === 'hast', // mapped urgent to priority
              status: quote.status,
            });
          }

          if (quote.start_date) {
            evts.push({
              id: `start-${quote.id}`,
              quote_id: quote.id,
              type: 'start',
              date: quote.start_date,
              label: 'Start',
              customer_name: quote.name,
              address: quote.address,
              employee_name: empName,
              urgent: quote.priority === 'hast',
              status: quote.status,
            });
          }

          if (quote.due_date) {
            evts.push({
              id: `due-${quote.id}`,
              quote_id: quote.id,
              type: 'due',
              date: quote.due_date,
              label: 'Due',
              customer_name: quote.name,
              address: quote.address,
              employee_name: empName,
              urgent: quote.priority === 'hast',
              status: quote.status,
            });
          }
        }

        setEvents(evts);
      } catch (err) {
        console.error('Error loading calendar data:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const now = new Date();
  let filteredEvents = [...events];

  if (range === '30') {
    const in30 = new Date();
    in30.setDate(now.getDate() + 30);
    filteredEvents = filteredEvents.filter((e) => {
      const d = new Date(e.date);
      return d >= now && d <= in30;
    });
  }

  filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group by date (YYYY-MM-DD)
  const groups = {};
  for (const e of filteredEvents) {
    const key = e.date.slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  }

  const groupEntries = Object.entries(groups).sort(
    ([d1], [d2]) => new Date(d1).getTime() - new Date(d2).getTime()
  );

  const statusColor = (status) => {
    switch (status) {
      case 'Ny':
        return 'bg-red-500/10 text-red-400 border-red-500/40';
      case 'Pågår':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/40';
      case 'Fullført':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40';
      default:
        return 'bg-brand-800 text-brand-300 border-brand-700';
    }
  };

  const typeLabel = (type) => {
    switch (type) {
      case 'inspection':
        return 'Inspection';
      case 'start':
        return 'Start';
      case 'due':
        return 'Deadline';
      default:
        return type;
    }
  };

  return (
    <AdminLayout title="Calendar">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <CalendarIcon className="w-7 h-7 text-accent-blue" />
              Schedule / Calendar
            </h1>
            <p className="text-brand-400 text-sm">
              Oversikt over befaringer, startdatoer og frister for alle jobber.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="bg-brand-900 border border-brand-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="30">Next 30 days</option>
              <option value="all">All dates</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        <Card>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-10 h-10 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
            </div>
          ) : groupEntries.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-brand-400 text-sm">
                No scheduled events in this range yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {groupEntries.map(([date, evts]) => {
                const dateObj = new Date(date);
                const dateLabel = dateObj.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div key={date} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-blue" />
                      <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
                        {dateLabel}
                      </h2>
                    </div>

                    <div className="space-y-2 pl-4 border-l border-brand-800">
                      {evts.map((e) => (
                        <div
                          key={e.id}
                          className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-brand-900/60 border border-brand-800 rounded-xl px-3 py-2"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full border ${statusColor(
                                  e.status
                                )}`}
                              >
                                {typeLabel(e.type)}
                              </span>
                              {e.urgent && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-white">
                              {e.customer_name || 'Unknown customer'}
                            </p>
                            <p className="text-[11px] text-brand-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {e.address || 'No address'}
                            </p>
                            {e.employee_name && (
                              <p className="text-[11px] text-brand-400 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {e.employee_name}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-[11px] text-brand-500">
                              <Clock className="w-3 h-3" />
                              {new Date(e.date).toLocaleTimeString(undefined, {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[11px] px-2 py-1 h-auto min-h-0"
                              onClick={() => router.push(`/admin/quote/${e.quote_id}`)}
                            >
                              Details
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
