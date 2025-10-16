import Link from 'next/link';

export default function Home() {
  return (
    <section className="container-default py-20">
      <h1 className="text-3xl font-semibold">Hansen IT – CRM</h1>
      <p className="text-white/80 mt-2">Velg visning:</p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="btn">Tabell</Link>
        <Link href="/dashboard/kanban" className="btn">Kanban</Link>
      </div>
    </section>
  );
}
