export const metadata = {
  title: "Sikkerhetspolicy – Hansen IT",
  description: "Hvordan melde fra om sikkerhetssårbarheter hos Hansen IT.",
};

export default function SecurityPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-widest text-slate-500">Sikkerhet</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Melde en sårbarhet</h1>

        <div className="mt-10 space-y-10 leading-relaxed text-slate-300">
          <p>
            Vi setter pris på at sikkerhetsforskere og andre hjelper oss med å
            holde tjenestene våre trygge. Denne siden beskriver hvordan du melder
            fra — og hva du kan forvente av oss.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-white">Hvordan melde fra</h2>
            <p className="mt-3">
              Send e-post til{" "}
              <a className="text-cyan-300 underline underline-offset-2" href="mailto:security@hansen-it.com">
                security@hansen-it.com
              </a>
              . Du kan også bruke kontaktskjemaet på{" "}
              <a className="text-cyan-300 underline underline-offset-2" href="https://hansen-it.com/contact">
                hansen-it.com/contact
              </a>
              {" "}og merke at det gjelder sikkerhet.
            </p>
            <p className="mt-3">Inkluder gjerne:</p>
            <ul className="mt-2 list-disc space-y-1 pl-6">
              <li>Hvilken tjeneste eller URL det gjelder</li>
              <li>Kort beskrivelse av sårbarheten</li>
              <li>Steg for å gjenskape (PoC)</li>
              <li>Eventuell påvirkning (hva en angriper kan oppnå)</li>
              <li>Om du ønsker å bli kreditert hvis vi publiserer en oppsummering</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Hva vi lover</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Bekreftelse på at vi har mottatt meldingen innen 5 virkedager.</li>
              <li>
                Vi tar ikke rettslige skritt mot forskere som handler i god tro,
                holder seg innenfor denne policyen, og unngår å skade systemer
                eller andres data.
              </li>
              <li>
                Kreditering etter avtale hvis du ønsker det — når saken er
                håndtert.
              </li>
              <li>
                Vi ber om at du gir oss rimelig tid til å fikse før offentlig
                omtale.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Utenfor scope</h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Denial of service (DoS/DDoS) og volumtester</li>
              <li>Social engineering mot ansatte eller kunder</li>
              <li>Fysisk sikkerhet (kontor, lokaler, utstyr)</li>
              <li>
                Rapporter fra automatiske skannere uten verifisert impact —
                vi trenger konkret PoC eller bevis på effekt
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Bug bounty</h2>
            <p className="mt-3">
              Vi har ikke et bug bounty-program, og vi tilbyr ikke belønning i
              penger. Takk likevel — ansvarlige rapporter hjelper oss, og vi
              krediterer gjerne når det passer.
            </p>
          </section>

          <p className="text-sm text-slate-500">
            Se også{" "}
            <a className="underline underline-offset-2" href="/.well-known/security.txt">
              /.well-known/security.txt
            </a>{" "}
            (RFC 9116).
          </p>
        </div>
      </div>
    </main>
  );
}
