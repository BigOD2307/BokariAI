import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ExternalLink } from 'lucide-react';
import BkNav from '@/components/home/canvas/BkNav';
import { getAfricaStats } from '@/lib/stats/store';
import { SOURCES } from '@/lib/stats/schema';
import {
  RankingBarChart,
  ComparisonBarChart,
  TrendAreaChart,
  TrendLineChart,
  ShareDonut,
} from '@/components/data/DataCharts';
import {
  POPULATION_TOP,
  POPULATION_TREND,
  ECONOMY_TOP,
  GROWTH_TREND,
  SECTOR_SHARES,
  DIGITAL_COMPARE,
  DIGITAL_TREND,
} from '@/lib/stats/charts';

export const metadata: Metadata = {
  title: "L'Afrique en chiffres — les données du continent | Bokari",
  description:
    "Population, démographie, économie et numérique : les chiffres clés de l'Afrique en graphiques, sourcés (ONU, Banque mondiale, GSMA, FMI, BAD) et mis à jour chaque semaine par Bokari.",
  alternates: { canonical: 'https://bokari.dev/data' },
  robots: 'index,follow',
};

// Figures are refreshed weekly by the autonomous stats cron — render at request
// time so the page always shows the latest values.
export const dynamic = 'force-dynamic';

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

function ChartCard({
  title,
  src,
  children,
}: {
  title: string;
  src?: number;
  children: React.ReactNode;
}) {
  return (
    <figure className="rounded-[18px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_5px_0_rgba(15,23,42,0.07)] sm:p-6">
      <figcaption className="mb-4 text-[14px] font-semibold text-[color:var(--bk-ink,#0f172a)]">
        {title}
        {src && <Sup n={src} />}
      </figcaption>
      {children}
    </figure>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default async function DataPage() {
  const stats = await getAfricaStats();
  const v = (key: string) => stats[key]?.value ?? '—';

  // Freshest update timestamp across all stored figures (credibility line).
  const updatedAt = Object.values(stats)
    .map((s) => s.updatedAt)
    .filter(Boolean)
    .sort()
    .pop();
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const HERO = [
    { value: v('hero.population'), label: 'habitants', src: 1 },
    { value: v('hero.countries'), label: 'pays', src: 5 },
    { value: v('hero.medianAge'), label: 'âge médian', src: 1 },
    { value: v('hero.languages'), label: 'langues', src: 6 },
  ];

  const popBars = POPULATION_TOP.map((d) => ({ name: d.country, value: d.millions }));
  const popTrend = POPULATION_TREND.map((d) => ({ year: d.year, value: d.millions }));
  const ecoBars = ECONOMY_TOP.map((d) => ({ name: d.country, value: d.billions }));
  const growthTrend = GROWTH_TREND.map((d) => ({ year: d.year, value: d.growth }));
  const sectorDonut = SECTOR_SHARES.map((d) => ({ name: d.sector, value: d.pct }));
  const digitalBars = DIGITAL_COMPARE.map((d) => ({ name: d.name, value: d.millions }));
  const digitalTrend = DIGITAL_TREND.map((d) => ({ year: d.year, value: d.millions }));

  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 md:px-6 lg:pt-16">
        <p className="bk-eyebrow text-base sm:text-lg">Les données</p>
        <h1 className="bk-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          L&apos;Afrique en <span className="bk-underline">chiffres</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          Un panorama clair et sourcé du continent — population, économie, numérique — en graphiques.
          Chaque chiffre renvoie à sa source, et les valeurs clés sont vérifiées chaque semaine.
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
        {updatedLabel && (
          <p className="mt-3 font-hand text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
            Mis à jour le {updatedLabel} — vérifié par Bokari.
          </p>
        )}

        {/* Population */}
        <Section eyebrow="Population & démographie" title="Un continent jeune et nombreux">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Pays les plus peuplés (millions d'habitants)" src={1}>
              <RankingBarChart data={popBars} unit="M" accent="#14b8a6" height={340} />
            </ChartCard>
            <ChartCard title="Une population qui double d'ici 2050 (millions)" src={1}>
              <TrendAreaChart data={popTrend} unit="M" accent="#14b8a6" height={340} />
            </ChartCard>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard value={v('hero.medianAge')} label="Âge médian" sub="le plus jeune au monde" src={1} />
            <StatCard value={v('pop.urbanization')} label="Urbanisation" sub="~56 % projeté en 2050" src={2} />
            <StatCard value={v('pop.youth')} label="Moins de 25 ans" sub="dividende démographique" src={1} />
          </div>
        </Section>

        {/* Economy */}
        <Section eyebrow="Économie" title="Des géants et des champions de croissance">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Plus grandes économies — PIB nominal (Md $)" src={4}>
              <RankingBarChart data={ecoBars} unit="Md $" accent="#d4b483" height={340} />
            </ChartCard>
            <ChartCard title="Croissance du PIB réel (%)" src={4}>
              <TrendLineChart data={growthTrend} unit="%" accent="#0f766e" height={300} />
            </ChartCard>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Le PIB par secteur (Afrique subsaharienne)" src={2}>
              <ShareDonut data={sectorDonut} height={300} />
            </ChartCard>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <StatCard value={v('eco.senegalGrowth')} label="Sénégal" sub="parmi les croissances les plus rapides" src={4} />
              <StatCard value={v('eco.literacy')} label="Alphabétisation" sub="de 40 % (Niger) à 95 % (Afrique du Sud)" src={8} />
              <StatCard value={v('eco.renewable')} label="Électricité renouvelable" sub="hydro, solaire, éolien" src={2} />
              <StatCard value="+4,2 %" label="Croissance Afrique 2025" sub="puis +4,3 % projeté en 2026" src={4} />
            </div>
          </div>
        </Section>

        {/* Digital */}
        <Section eyebrow="Numérique & mobile" title="Le saut technologique du mobile">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Mobile, internet, mobile money (millions, Afrique subsaharienne)" src={3}>
              <ComparisonBarChart data={digitalBars} unit="M" accent="#14b8a6" height={300} />
            </ChartCard>
            <ChartCard title="Les internautes africains, en forte hausse (millions)" src={7}>
              <TrendAreaChart data={digitalTrend} unit="M" accent="#0f766e" height={300} />
            </ChartCard>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <StatCard value={v('dig.mobileSubs')} label="Abonnements mobiles" sub="~47 % de la population" src={3} />
            <StatCard value={v('dig.internet')} label="Internautes" sub="~28 % de pénétration, en hausse" src={7} />
            <StatCard value={v('dig.mobileMoney')} label="Comptes mobile money" sub="l'Afrique, leader mondial du paiement mobile" src={3} />
          </div>
        </Section>

        {/* Diversity */}
        <Section eyebrow="Diversité" title="La plus grande richesse linguistique du monde">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard value={v('div.languages')} label="Langues parlées" sub="500+ rien qu'au Nigeria" src={6} />
            <StatCard value={v('div.countries')} label="Pays" sub="membres de l'Union africaine" src={5} />
            <StatCard value={v('div.dataCost')} label="Coût des données" sub="du revenu mensuel (vs 2-5 % mondial)" src={3} />
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
            Chiffres récents et représentatifs, arrondis pour la lisibilité ; certaines projections (population 2030-2050,
            croissance 2026-2027) sont des scénarios médians. Numérique & mobile money : périmètre Afrique subsaharienne.
            Pour une donnée précise et à jour, demande à Bokari — il cherche et cite ses sources.
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
