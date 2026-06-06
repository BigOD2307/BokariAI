import type { Metadata } from 'next';
import { getAllArticles, getFeaturedArticle } from '@/lib/blog/articles';
import BkNav from '@/components/home/canvas/BkNav';
import CategoryNav from '@/components/blog/CategoryNav';
import FeaturedArticle from '@/components/blog/FeaturedArticle';
import ArticleCard from '@/components/blog/ArticleCard';

export const metadata: Metadata = {
  title: 'Le blog de Bokari — actus vérifiées & fact-checks',
  description:
    "Articles vérifiés et sourcés par Bokari : fact-checks, économie, politique, tech et société africaines — chaque fait cité.",
  alternates: { canonical: 'https://bokari.dev/blog' },
  robots: 'index,follow',
};

export const dynamic = 'force-dynamic';

export default async function BlogIndex() {
  const featured = await getFeaturedArticle();
  const all = await getAllArticles();
  const rest = all.filter((a) => a.slug !== featured?.slug);

  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 md:px-6 lg:pt-16">
        <p className="bk-eyebrow text-base sm:text-lg">Le blog de Bokari</p>
        <h1 className="bk-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          L&apos;actu, <span className="bk-underline">vérifiée</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          Fact-checks, économie, politique, tech et société du continent — recoupés et sourcés par
          Bokari. Chaque affirmation est citée et vérifiable.
        </p>

        <div className="mt-8">
          <CategoryNav />
        </div>

        {featured && (
          <div className="mt-8">
            <FeaturedArticle article={featured} />
          </div>
        )}

        {rest.length > 0 && (
          <section className="mt-14">
            <h2 className="font-hand text-[16px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
              Derniers articles
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-[color:var(--bk-ink,#0f172a)]/10 px-4 py-8 text-center text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
        <span className="font-display text-[color:var(--bk-ink,#0f172a)]">Bokari</span> · Une création
        Dicken AI · Ousmane Dicko · 2026
      </footer>
    </div>
  );
}
