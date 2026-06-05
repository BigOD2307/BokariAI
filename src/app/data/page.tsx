import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import BkNav from '@/components/home/canvas/BkNav';

export const metadata: Metadata = {
  title: "L'Afrique en chiffres — les données du continent | Bokari",
  description:
    "Population, démographie, économie et numérique : les chiffres clés de l'Afrique, sourcés (ONU, Banque mondiale, GSMA, FMI). Un panorama vérifié par Bokari.",
  alternates: { canonical: 'https://bokari.dev/data' },
  robots: 'index,follow',
};

/* ── Data (representative latest figures, sources cited below) ─────────────── */

const HERO = [
  { value: '1,4 Md', label: 'habitants', src: 1 },
  { value: '54', label: 'pays', src: 5 },
  { value: '~19 ans', label: 'âge médian', src: 1 },
  { value: '~2 100', label: 'langues', src: 6 },
];

const POP_TOP = [
  { name: 'Nigeria', value: 223 },
  { name: 'Éthiopie', value: 123 },
  { name: 'Égypte', value: 107 },
  { name: 'RD Congo', value: 99 },
  { name: 'Tanzanie', value: 65 },
];

const ECO_TOP = [
  { name: 'Nigeria', value: 477 },
  { name: 'Égypte', value: 406 },
  { name: 'Afrique du Sud', value: 405 },
  { name: 'Algérie', value: 267 },
  { name: 'Maroc', value: 162 },
];

const SOURCES = [
  { id: 1, label: 'ONU DESA — World Population Prospects 2024', url: 'https://population.un.org/wpp/' },
  { id: 2, label: 'Banque mondiale — Indicateurs du développement', url: 'https://data.worldbank.org/' },
  { id: 3, label: 'GSMA Intelligence — The Mobile Economy 2024', url: 'https://www.gsma.com/mobileeconomy/' },
  { id: 4, label: 'FMI — World Economic Outlook 2023', url: 'https://www.imf.org/en/Publications/WEO' },
  { id: 5, label: 'Union africaine — États membres', url: 'https://au.int/' },
  { id: 6, label: 'Ethnologue — Languages of the World', url: 'https://www.ethnologue.com/' },
  { id: 7, label: 'UIT — Mesure du numérique', url: 'https://www.itu.int/' },
  { id: 8, label: 'UNESCO UIS — Alphabétisation', url: 'https://uis.unesco.org/' },
];

/* ── Presentational helpers ────────────────────────────────────────────────── */

function Sup({ n }: { n: number }) {
  return <sup className="ml-0.5 text-[10px] font-bold text-[color:var(--bk-teal-700,#0f766e)]">{n}</sup>;
}

function StatCard({
  value,
  label,
  sub,
  src,
}: {
  value: string;
  label: string;
  sub?: string;
  src?: number;
}) {
  return (
    <div className="rounded-[16px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_4px_0_rgba(15,23,42,0.06)]">
      <p className="bk-display text-[2rem] leading-none text-[color:var(--bk-ink,#0f172a)]">
        {value}
        {src && <Sup n={src} />}
      </p>
      <p className="mt-2 text-[14px] font-semibold text-[color:var(--bk-ink,#0f172a)]">{label}</p>
      {sub && <p className="mt-1 text-[12px] leading-snug text-[color:var(--bk-ink-soft,#334155)]">{sub}</p>}
    </div>
  );
}

function BarList({
  items,
  unit,
  accent,
}: {
  items: { name: string; value: number }[];
  unit: string;
  accent: string;
}) {
  const max = Math.max(...items.map((i) => i.value));
  return (
    <div className="flex flex-col gap-3">
      {items.map((it) => (
        <div key={it.name} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[13px] font-medium text-[color:var(--bk-ink,#0f172a)] sm:w-32">
            {it.name}
          </span>
          <div className="relative h-7 flex-1 overflow-hidden rounded-lg border-2 border-[color:var(--bk-ink,#0f172a)]/10 bg-[color:var(--bk-ink,#0f172a)]/[0.03]">
            <div
              className="h-full rounded-md transition-[width]"
              style={{ width: `${(it.value / max) * 100}%`, backgroundColor: accent }}
            />
          </div>
          <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-[color:var(--bk-ink-soft,#334155)] sm:w-20">
            {it.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16">
      <p className="font-hand text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
        {eyebrow}
      </p>
      <h2 className="bk-display mt-1 text-3xl leading-tight text-[color:var(--bk-ink,#0f172a)] sm:text-4xl">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function DataPage() {
  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 md:px-6 lg:pt-16">
        <p className="bk-eyebrow text-base sm:text-lg">Les données</p>
        <h1 className="bk-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          L&apos;Afrique en <span className="bk-underline">chiffres</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          Un panorama clair et sourcé du continent — population, économie, numérique. Chaque chiffre
          renvoie à sa source. Valeurs récentes et représentatives.
        </p>

        {/* Hero stat band */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {HERO.map((s) => (
            <div
              key={s.label}
              className="rounded-[18px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-[color:var(--bk-mint,#c8f4e0)]/40 p-5 shadow-[0_5px_0_rgba(15,23,42,0.07)]"
            >
              <p className="bk-display text-[2.4rem] leading-none text-[color:var(--bk-ink,#0f172a)]">
                {s.value}
                <Sup n={s.src} />
              </p>
              <p className="mt-2 text-[14px] font-semibold text-[color:var(--bk-ink,#0f172a)]">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Population */}
        <Section eyebrow="Population & démographie" title="Un continent jeune et nombreux">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard value="1,4 Md" label="Habitants" sub="2e continent le plus peuplé" src={1} />
            <StatCard value="~19 ans" label="Âge médian" sub="le plus jeune au monde" src={1} />
            <StatCard value="~43 %" label="Urbanisation" sub="~56 % projeté en 2050" src={2} />
            <StatCard value="~19 %" label="Jeunes (15-24 ans)" sub="dividende démographique" src={2} />
          </div>
          <div className="mt-6 rounded-[18px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_4px_0_rgba(15,23,42,0.06)] sm:p-7">
            <p className="mb-4 text-[14px] font-semibold text-[color:var(--bk-ink,#0f172a)]">
              Pays les plus peuplés <span className="text-[color:var(--bk-ink-soft,#334155)]">(millions d&apos;habitants)</span>
              <Sup n={1} />
            </p>
            <BarList items={POP_TOP} unit="M" accent="#14b8a6" />
          </div>
        </Section>

        {/* Economy */}
        <Section eyebrow="Économie" title="Des géants et des champions de croissance">
          <div className="rounded-[18px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_4px_0_rgba(15,23,42,0.06)] sm:p-7">
            <p className="mb-4 text-[14px] font-semibold text-[color:var(--bk-ink,#0f172a)]">
              Plus grandes économies <span className="text-[color:var(--bk-ink-soft,#334155)]">(PIB nominal, milliards $)</span>
              <Sup n={4} />
            </p>
            <BarList items={ECO_TOP} unit="Md $" accent="#d4b483" />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <StatCard value="+4,8 %" label="Sénégal" sub="parmi les croissances les plus rapides" src={4} />
            <StatCard value="~67 %" label="Alphabétisation" sub="de 40 % (Niger) à 95 % (Afrique du Sud)" src={8} />
            <StatCard value="~48 %" label="Électricité renouvelable" sub="hydro, solaire, éolien" src={2} />
          </div>
        </Section>

        {/* Digital */}
        <Section eyebrow="Numérique & mobile" title="Le saut technologique du mobile">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value="~575 M" label="Abonnements mobiles" sub="+75 % de pénétration dans la plupart des pays" src={3} />
            <StatCard value="~320 M" label="Internautes" sub="~26 % de pénétration, en forte hausse" src={7} />
            <StatCard value="~250 M" label="Comptes mobile money" sub="l'Afrique, leader mondial du paiement mobile" src={3} />
          </div>
        </Section>

        {/* Diversity */}
        <Section eyebrow="Diversité" title="La plus grande richesse linguistique du monde">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value="~2 100" label="Langues parlées" sub="500+ rien qu'au Nigeria" src={6} />
            <StatCard value="54" label="Pays" sub="membres de l'Union africaine" src={5} />
            <StatCard value="~1,5–3 %" label="Coût des données" sub="du revenu mensuel (vs 2-5 % mondial)" src={3} />
          </div>
        </Section>

        {/* Sources */}
        <section className="mt-16 rounded-2xl border-2 border-[color:var(--bk-ink,#0f172a)]/12 bg-white p-5 sm:p-6" aria-labelledby="sources-title">
          <h2 id="sources-title" className="font-display text-xl text-[color:var(--bk-ink,#0f172a)]">
            Sources
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {SOURCES.map((s) => (
              <li key={s.id} className="flex gap-3 text-[13px] leading-snug">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--bk-teal,#14b8a6)]/12 text-[11px] font-bold text-[color:var(--bk-teal-700,#0f766e)]">
                  {s.id}
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="group inline-flex items-baseline gap-1.5 text-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-teal-700,#0f766e)]"
                >
                  <span className="underline-offset-2 group-hover:underline">{s.label}</span>
                  <ExternalLink size={12} strokeWidth={2} className="self-center opacity-50" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[12px] text-[color:var(--bk-ink-soft,#334155)]">
            Chiffres récents et représentatifs, arrondis pour la lisibilité. Pour une donnée précise et
            à jour, demande à Bokari — il cherche et cite ses sources.
          </p>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-3xl border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-7 text-center shadow-[0_6px_0_rgba(15,23,42,0.06)] sm:p-9">
          <h2 className="font-display text-2xl leading-tight sm:text-3xl">Une question sur l&apos;Afrique ?</h2>
          <p className="font-hand mx-auto mt-3 max-w-md text-lg text-[color:var(--bk-ink-soft,#334155)]">
            Pose-la à Bokari : il cherche, vérifie et répond avec des sources.
          </p>
          <Link
            href="/"
            className="font-hand mt-6 inline-flex items-center gap-1.5 rounded-xl border-2 border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] px-5 py-2.5 text-[15px] uppercase tracking-wide text-white shadow-[0_4px_0_var(--bk-teal-700,#0f766e)] transition-transform hover:-translate-y-px active:translate-y-[2px] active:shadow-[0_2px_0_var(--bk-teal-700,#0f766e)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
          >
            Poser une question
            <ArrowRight size={16} strokeWidth={2.4} aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-[color:var(--bk-ink,#0f172a)]/10 px-4 py-8 text-center text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
        <span className="font-display text-[color:var(--bk-ink,#0f172a)]">Bokari</span> · Une création
        Dicken AI · Ousmane Dicko · 2026
      </footer>
    </div>
  );
}
