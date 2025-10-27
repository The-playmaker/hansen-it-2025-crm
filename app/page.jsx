// app/dashboard/page.jsx
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic'; // eller: export const revalidate = 0;

export default async function Dashboard() {
  const cookieStore = cookies();

  // NB: no-ops for set/remove i RSC
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set() {},       // no-op i server component
        remove() {},    // no-op i server component
      },
    }
  );

  // Krev innlogging
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Hent data
  const { data: requests, error } = await supabase
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    // valgfritt: logg/vis feilmelding
    console.error('Supabase error (requests):', error);
  }

  return (
    <section className="container-default py-10">
      <h1 className="text-2xl font-semibold mb-6">Henvendelser</h1>

      {(!requests || requests.length === 0) ? (
        <p className="text-white/70">Ingen henvendelser enda.</p>
      ) : (
        <div className="rounded border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-3">Tid</th>
                <th className="text-left p-3">Navn</th>
                <th className="text-left p-3">E-post</th>
                <th className="text-left p-3">Prioritet</th>
                <th className="text-left p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-white/10">
                  <td className="p-3">{r.created_at ? new Date(r.created_at).toLocaleString('no-NO') : '-'}</td>
                  <td className="p-3">{r.name || '-'}</td>
                  <td className="p-3">{r.email || '-'}</td>
                  <td className="p-3">{r.priority || '-'}</td>
                  <td className="p-3">{r.status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
