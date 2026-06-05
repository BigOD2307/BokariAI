import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategory, getCategorySlugs } from '@/lib/blog/categories';
import { getArticlesByCategory } from '@/lib/blog/articles';
import BkNav from '@/components/home/canvas/BkNav';
import CategoryNav from '@/components/blog/CategoryNav';
import ArticleCard from '@/components/blog/ArticleCard';

export function generateStaticParams() {
  return getCategorySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) return { title: 'Rubrique introuvable — Bokari', robots: 'noindex' };
  return {
    title: `${cat.label} — Le blog de Bokari`,
    description: cat.description,
    alternates: { canonical: `https://bokari.dev/blog/categorie/${cat.slug}` },
    robots: 'index,follow',
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const cat = getCategory(slug);
  if (!cat) notFound();

  const articles = getArticlesByCategory(slug);

  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />

      <main className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-12 md:px-6 lg:pt-16">
        <p className="bk-eyebrow text-base sm:text-lg">Rubrique</p>
        <h1 className="bk-display mt-3 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl">
          {cat.label}
        </h1>
        <div className="mt-4 h-1.5 w-16 rounded-full" style={{ backgroundColor: cat.edge }} />
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          {cat.description}
        </p>

        <div className="mt-8">
          <CategoryNav activeSlug={cat.slug} />
        </div>

        {articles.length > 0 ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        ) : (
          <p className="mt-12 rounded-2xl border-2 border-dashed border-[color:var(--bk-ink,#0f172a)]/15 px-5 py-10 text-center text-[15px] text-[color:var(--bk-ink-soft,#334155)]">
            Aucun article pour le moment dans cette rubrique. Revenez bientôt — Bokari publie
            régulièrement.
          </p>
        )}
      </main>

      <footer className="border-t border-[color:var(--bk-ink,#0f172a)]/10 px-4 py-8 text-center text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
        <span className="font-display text-[color:var(--bk-ink,#0f172a)]">Bokari</span> · Une création
        Dicken AI · Ousmane Dicko · 2026
      </footer>
    </div>
  );
}
