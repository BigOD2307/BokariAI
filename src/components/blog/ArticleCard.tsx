import Link from 'next/link';
import { Clock } from 'lucide-react';
import type { Article } from '@/lib/blog/articles';
import { getCategory } from '@/lib/blog/categories';
import CategoryBadge from './CategoryBadge';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * ArticleCard — a paper card (2px ink border + 3D shadow) for an article in the
 * index grids and category pages. Title stays in a readable sans for credibility;
 * the rubrique tag carries the colour. Serious, but unmistakably Canvas.
 */
const ArticleCard = ({ article }: { article: Article }) => {
  const cat = getCategory(article.category);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex h-full flex-col rounded-[16px] border-2 border-[color:var(--bk-ink,#0f172a)] bg-white p-5 shadow-[0_4px_0_rgba(15,23,42,0.08)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-2"
    >
      {cat && <CategoryBadge category={cat} />}
      <h3 className="mt-3 text-[18px] font-semibold leading-snug tracking-tight text-[color:var(--bk-ink,#0f172a)]">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
        {article.excerpt}
      </p>
      <div className="mt-4 flex items-center gap-3 pt-1 text-[12px] text-[color:var(--bk-ink,#0f172a)]/45">
        <span>{formatDate(article.publishedAt)}</span>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} strokeWidth={2} aria-hidden="true" />
          {article.readingMinutes} min
        </span>
      </div>
    </Link>
  );
};

export default ArticleCard;
