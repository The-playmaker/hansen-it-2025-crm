'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Calendar as CalendarIcon, Clock, User, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';


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

 
}
