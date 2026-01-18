'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { supabase } from '@/lib/supabaseClient';
import { LogOut, Settings } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminDashboard() {
  const router = useRouter();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);

  // Map old statuses (if they exist in your DB) to new ones or just use what you have
  // Existing requests table seems to use: 'Ny', 'Pågår', 'Fullført'
  // The provided code uses: 'new', 'in_progress', 'completed'
  // I will map them for display or usage.
  // 'Ny' -> 'new', 'Pågår' -> 'in_progress', 'Fullført' -> 'completed'

  const DB_STATUS_MAP = {
    'new': 'Ny',
    'in_progress': 'Pågår',
    'completed': 'Fullført'
  };

  const REVERSE_DB_STATUS_MAP = {
    'Ny': 'new',
    'Pågår': 'in_progress',
    'Fullført': 'completed'
  };

  useEffect(() => {
    fetchQuotes();
    const channel = supabase
      .channel('requests-changes-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        fetchQuotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchQuotes = async () => {
    try {
      let query = supabase.from('requests').select('*').order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', DB_STATUS_MAP[statusFilter] || statusFilter);
      }

      const { data } = await query;
      setQuotes(data || []);
    } catch (error) {
      console.error('Error fetching quotes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (quoteId, newStatus) => {
    // newStatus is coming from the select which uses 'new', 'in_progress', 'completed'
    // We need to convert it back to the DB format
    const dbStatus = DB_STATUS_MAP[newStatus] || newStatus;

    try {
      await supabase
        .from('requests')
        .update({ status: dbStatus })
        .eq('id', quoteId);

      fetchQuotes();
    } catch (error) {
      console.error('Error updating quote:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const statuses = [
    { value: 'new', label: 'New', color: 'bg-red-500/20 border-red-500 text-red-400' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-500/20 border-yellow-500 text-yellow-400' },
    { value: 'completed', label: 'Completed', color: 'bg-emerald-500/20 border-emerald-500 text-emerald-400' },
  ];

  const getStatusValue = (dbStatus) => REVERSE_DB_STATUS_MAP[dbStatus] || 'new';

  const newCount = quotes.filter(q => getStatusValue(q.status) === 'new').length;
  const inProgressCount = quotes.filter(q => getStatusValue(q.status) === 'in_progress').length;
  const completedCount = quotes.filter(q => getStatusValue(q.status) === 'completed').length;
  const urgentInProgressCount = quotes.filter( (q) => q.status === 'in_progress' && q.urgent).length;

  return (
    <AdminLayout title="Admin Dashboard">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/admin/services')}
              className="flex items-center gap-2"
            >
              <Settings size={18} />
              Services
            </Button>
            <Button
              variant="secondary"
              onClick={handleLogout}
              className="flex items-center gap-2"
            >
              <LogOut size={18} />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <div className="space-y-2">
              <p className="text-brand-400 text-sm font-medium">New Requests</p>
              <p className="text-3xl font-bold text-accent-blue">{newCount}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-2">
              <p className="text-brand-400 text-sm font-medium">In Progress</p>
              <p className="text-3xl font-bold text-accent-orange">{inProgressCount}</p>
            </div>
          </Card>
          <Card>
            <div className="space-y-2">
              <p className="text-brand-400 text-sm font-medium">Completed</p>
              <p className="text-3xl font-bold text-accent-emerald">{completedCount}</p>
            </div>
          </Card>
          <Card>
              <p className="text-brand-400 text-sm font-medium">Urgent In Progress</p>
              <p className="text-3xl font-bold text-red-400">{urgentInProgressCount}</p>
          </Card>
        </div>

        <Card>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Quote Requests</h2>
              <select
                value={statusFilter || ''}
                onChange={(e) => {
                  setStatusFilter(e.target.value || null);
                }}
                className="bg-brand-900 border border-brand-700 rounded-lg px-4 py-2 text-white"
              >
                <option value="">All Requests</option>
                <option value="new">New</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-2 border-accent-blue border-t-transparent animate-spin"></div>
              </div>
            ) : quotes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-700">
                      <th className="text-left py-3 px-4 font-semibold text-white">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Phone</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Company (Service)</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Urgent</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Date</th>
                      <th className="text-left py-3 px-4 font-semibold text-white">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((quote) => (
                      <tr key={quote.id} className="border-b border-brand-700 hover:bg-brand-900/50">
                        <td className="py-3 px-4 text-white">{quote.name || 'No Name'}</td>
                        <td className="py-3 px-4 text-brand-300">{quote.email || '-'}</td>
                        <td className="py-3 px-4 text-brand-300">{quote.phone || '-'}</td>
                        <td className="py-3 px-4 text-brand-300">
                          {quote.company || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={getStatusValue(quote.status)}
                            onChange={(e) => handleStatusChange(quote.id, e.target.value)}
                            className={`rounded px-3 py-1 text-xs font-medium border ${
                              statuses.find(s => s.value === getStatusValue(quote.status))?.color || 'bg-brand-800'
                            }`}
                          >
                            {statuses.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          {(quote.priority === 'hast') ? (
                            <span className="inline-block px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                              Yes
                            </span>
                          ) : (
                            <span className="text-brand-500">No</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-brand-300 text-xs">
                          {new Date(quote.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => router.push(`/admin/quote/${quote.id}`)}
                            className="text-accent-blue hover:text-accent-cyan transition-colors text-sm font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-brand-400">No requests yet.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
