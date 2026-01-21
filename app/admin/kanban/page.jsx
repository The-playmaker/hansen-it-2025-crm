"use client";
export const dynamic = "force-dynamic";

export default function KanbanPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white">Kanban</h1>
      <p className="text-brand-300 mt-2">OK – page renders.</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Flame, User, MapPin } from 'lucide-react';


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

 
}
