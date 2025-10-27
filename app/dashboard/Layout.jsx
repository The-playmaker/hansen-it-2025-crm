import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic"; // unngå cache på interne sider

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black to-zinc-900 text-white">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex">
          {/* Sidebar (skjult på mobil) */}
          <Sidebar />

          {/* Innhold */}
          <div className="flex-1 min-h-screen">
            {/* Topbar (mobil-nav + statusplass) */}
            <header className="md:hidden sticky top-0 z-10 h-14 border-b border-white/10 bg-black/60 backdrop-blur">
              <div className="h-full px-4 flex items-center justify-between">
                <div className="font-semibold">Hansen IT • CRM</div>
                {/* plass til mobilmeny senere */}
              </div>
            </header>

            <main className="p-4 md:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
