import Link from 'next/link';
import { Clock, ArrowRight, BadgeCheck } from 'lucide-react';
import type { Article } from '@/lib/blog/articles';
import { getCategory } from '@/lib/blog/categories';
import CategoryBadge from './CategoryBadge';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * FeaturedArticle — the "À la une" hero: a large paper card topped with the
 * rubrique's accent band, a big readable title, and a clear call to read.
 */
const FeaturedArticle = ({ article }: { article: Article }) => {
  const cat = getCategory(article.category);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group block overflow-hidden rounded-[22px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white shadow-[0_6px_0_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
    >
      <div className="h-2.5 w-full" style={{ backgroundColor: cat?.edge ?? '#5eead4' }} />
      <div className="p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-hand inline-flex items-center gap-1.5 text-[14px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
            <BadgeCheck size={15} strokeWidth={2.4} aria-hidden="true" />
            À la une
          </span>
          {cat && <CategoryBadge category={cat} />}
        </div>

        <h2 className="mt-4 text-balance text-2xl font-semibold leading-[1.12] tracking-tight text-[color:var(--bk-ink,#0f172a)] sm:text-3xl lg:text-[2.1rem]">
          {article.title}
        </h2>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          {article.excerpt}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[color:var(--bk-ink,#0f172a)]/50">
          <span>{formatDate(article.publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock size={13} strokeWidth={2} aria-hidden="true" />
            {article.readingMinutes} min de lecture
          </span>
          <span className="font-hand ml-auto inline-flex items-center gap-1.5 text-[15px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]">
            Lire l&apos;article
            <ArrowRight size={15} strokeWidth={2.4} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default FeaturedArticle;
