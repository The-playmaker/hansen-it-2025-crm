// app/dashboard/page.jsx
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function Dashboard() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  );

  const { data: requests } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <section className="container-default py-10">
      <h1 className="text-2xl font-semibold mb-6">Henvendelser</h1>
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
            {(requests || []).map((r) => (
              <tr key={r.id} className="border-t border-white/10">
                <td className="p-3">{new Date(r.created_at).toLocaleString("no-NO")}</td>
                <td className="p-3">{r.name}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3">{r.priority}</td>
                <td className="p-3">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
