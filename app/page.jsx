import Link from "next/link";
import AuthWatcher from "../components/AuthWatcher";

export const metadata = {
  title: "Hansen IT – CRM Dashboard",
  description: "Internt dashboard for henvendelser",
};

export default function Home() {
  return (
    <section className="container-default py-20">
      <AuthWatcher />
      <h1 className="text-3xl font-semibold">Hansen IT – CRM</h1>
      <p className="text-white/80 mt-2">Velg visning:</p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="btn">
          Tabell
        </Link>
        <Link href="/dashboard/kanban" className="btn">
          Kanban
        </Link>
      </div>
    </section>
  );
}
