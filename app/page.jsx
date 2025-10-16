import Link from 'next/link';

export default function Home() {
  return (
    <section className="container-default py-20">
      <h1 className="text-3xl font-semibold">Hansen IT – CRM</h1>
      <p className="text-white/80 mt-2">Gå til dashboard for å se innkomne forespørsler.</p>
      <Link href="/dashboard" className="btn mt-6 inline-block">Åpne dashboard</Link>
    </section>
  );
}
