'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, Calendar, MapPin, User } from 'lucide-react';

export default function QuotePortal() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!token) return;

    const load = async () => {
      try {
        setLoading(true);

        const { data: tokenRow, error: tokenError } = await supabase
          .from('quote_portal_tokens')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (tokenError || !tokenRow) {
          setInvalid(true);
          return;
        }

        if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
          setInvalid(true);
          return;
        }

        const { data: quote, error: quoteError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', tokenRow.quote_id)
          .maybeSingle();

        if (quoteError || !quote) {
          setInvalid(true);
          return;
        }

        let employee = null;
        if (quote.employee_id) {
          const { data: emp } = await supabase
            .from('employees')
            .select('*')
            .eq('id', quote.employee_id)
            .maybeSingle();

          employee = emp ?? null;
        }

        setData({ quote, employee, token: tokenRow });
      } catch (e) {
        console.error(e);
        setInvalid(true);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-accent-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  if (invalid || !data) {
    return (
      <div className="min-h-screen bg-brand-950 flex items-center justify-center px-4">
        <Card className="max-w-md text-center border-red-500 bg-red-500/10">
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <h1 className="text-xl font-bold text-white">Link not valid</h1>
            <p className="text-sm text-red-200">
              This access link is invalid or has expired.
              Please contact the company directly for an updated link.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const { quote, employee } = data;

  const statusLabel = (status) => {
    switch (status) {
      case 'Ny':
        return 'New – we have received your request';
      case 'Pågår':
        return 'In progress – we are working on your project';
      case 'Fullført':
        return 'Completed';
      default:
        return status || 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-brand-950">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-6">
        <Card className="border-accent-blue/60 bg-brand-900/80">
          <h1 className="text-2xl font-bold text-white mb-2">
            Your project with Hansen IT
          </h1>
          <p className="text-brand-300 text-sm">
            Here you can see the status and key details of your project.
          </p>
        </Card>

        <Card>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4" />
              Your details
            </h2>
            <p className="text-sm text-brand-300">
              <span className="font-medium text-white">Name:</span> {quote.name}
            </p>
            <p className="text-sm text-brand-300">
              <span className="font-medium text-white">Email:</span> {quote.email}
            </p>
            {quote.phone && (
                <p className="text-sm text-brand-300">
                  <span className="font-medium text-white">Phone:</span> {quote.phone}
                </p>
            )}
            {quote.address && (
                <p className="text-sm text-brand-300 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>
                    <span className="font-medium text-white">Address:</span> {quote.address}
                  </span>
                </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Project status & schedule
            </h2>

            <p className="text-sm text-brand-300">
              <span className="font-medium text-white">Status:</span>{' '}
              {statusLabel(quote.status)}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-brand-300">
              <div>
                <p className="font-medium text-white text-xs uppercase">Inspection</p>
                <p>
                  {quote.inspection_date
                    ? new Date(quote.inspection_date).toLocaleString()
                    : 'Not scheduled yet'}
                </p>
              </div>
              <div>
                <p className="font-medium text-white text-xs uppercase">Start</p>
                <p>
                  {quote.start_date
                    ? new Date(quote.start_date).toLocaleDateString()
                    : 'Not scheduled yet'}
                </p>
              </div>
              <div>
                <p className="font-medium text-white text-xs uppercase">Due</p>
                <p>
                  {quote.due_date
                    ? new Date(quote.due_date).toLocaleDateString()
                    : 'Not defined yet'}
                </p>
              </div>
            </div>

            {employee && (
              <div className="pt-3 border-t border-brand-800 mt-2">
                <p className="text-sm text-brand-300">
                  <span className="font-medium text-white">Assigned contact:</span>{' '}
                  {employee.name}
                  {employee.phone && ` · ${employee.phone}`}
                  {employee.email && ` · ${employee.email}`}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-3">Your request</h2>
          <p className="text-sm text-brand-300 whitespace-pre-wrap">
            {quote.message}
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-3">Need changes?</h2>
          <p className="text-sm text-brand-300 mb-3">
            If you want to change details or add information, please contact us
            by phone or email, and refer to your project ID:
          </p>
          <p className="text-sm text-accent-blue font-mono">
            Project ID: #{quote.id}
          </p>
        </Card>

        <div className="text-center text-[11px] text-brand-500 mt-6">
          Hansen IT – powered by CRM
        </div>
      </div>
    </div>
  );
}
