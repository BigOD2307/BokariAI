import Link from 'next/link';
import Markdown from 'markdown-to-jsx';
import { BadgeCheck, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import type { Article } from '@/lib/blog/articles';
import { getCategory } from '@/lib/blog/categories';
import BokariAvatar from '@/components/BokariAvatar';
import BkNav from '@/components/home/canvas/BkNav';
import CategoryBadge from './CategoryBadge';
import ArticleCard from './ArticleCard';
import BokariCTA from './BokariCTA';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * BkArticle — the Bokari blog article (single post) layout.
 *
 * Calm Notion-style editorial on paper: clean Inter title (Chewy stays for the
 * playful marketing surfaces), a readable measure, the journalistic "Sources"
 * block Bokari is built on, a "Vérifié par Bokari" mark, and a CTA back to the
 * search box. Server-friendly (no hooks) so the content ships in the initial
 * HTML for SEO.
 */
const BkArticle = ({
  article,
  related = [],
}: {
  article: Article;
  related?: Article[];
}) => {
  const cat = getCategory(article.category);
  return (
    <div className="bk-grid bk-grid-fade min-h-screen bg-white text-[color:var(--bk-ink,#0f172a)]">
      <BkNav />

      <article className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-10 md:px-6 lg:pt-14">
        <Link
          href="/blog"
          className="font-hand inline-flex items-center gap-1.5 text-[14px] text-[color:var(--bk-ink-soft,#334155)] transition-colors hover:text-[color:var(--bk-ink,#0f172a)]"
        >
          <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
          Tous les articles
        </Link>

        {/* Header */}
        <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px]">
          {cat && <CategoryBadge category={cat} href={`/blog/categorie/${cat.slug}`} />}
          <span className="inline-flex items-center gap-1.5 text-[color:var(--bk-ink-soft,#334155)]">
            <Clock size={14} strokeWidth={2} aria-hidden="true" />
            {article.readingMinutes} min de lecture
          </span>
        </div>

        <h1 className="mt-4 text-balance text-3xl font-semibold leading-[1.12] tracking-tight sm:text-4xl lg:text-[2.75rem]">
          {article.title}
        </h1>

        <p className="mt-5 text-lg leading-relaxed text-[color:var(--bk-ink-soft,#334155)]">
          {article.excerpt}
        </p>

        {/* Byline + verified mark */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-[color:var(--bk-ink,#0f172a)]/10 py-4 text-[14px]">
          <span className="inline-flex items-center gap-2">
            <BokariAvatar size={30} />
            <span className="font-medium">Par {article.author}</span>
          </span>
          <span className="text-[color:var(--bk-ink-soft,#334155)]">{formatDate(article.publishedAt)}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--bk-teal,#14b8a6)]/10 px-2.5 py-1 text-[12px] font-medium text-[color:var(--bk-teal-700,#0f766e)]">
            <BadgeCheck size={14} strokeWidth={2.2} aria-hidden="true" />
            Vérifié &amp; sourcé
          </span>
        </div>

        {/* Body */}
        <div className="prose prose-slate mt-8 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-[color:var(--bk-ink,#0f172a)] prose-h2:mt-10 prose-h2:text-2xl prose-p:leading-[1.75] prose-p:text-[color:var(--bk-ink-soft,#334155)] prose-strong:text-[color:var(--bk-ink,#0f172a)] prose-a:text-[color:var(--bk-teal-700,#0f766e)]">
          <Markdown options={{ forceBlock: true }}>{article.body}</Markdown>
        </div>

        {/* Sources */}
        {article.sources.length > 0 && (
          <section className="mt-12 rounded-2xl border-2 border-[color:var(--bk-ink,#0f172a)]/12 bg-white p-5 sm:p-6" aria-labelledby="sources-title">
            <h2 id="sources-title" className="font-display text-xl text-[color:var(--bk-ink,#0f172a)]">
              Sources
            </h2>
            <ol className="mt-4 flex flex-col gap-3">
              {article.sources.map((s) => (
                <li key={s.id} className="flex gap-3 text-[14px] leading-snug">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--bk-teal,#14b8a6)]/12 text-[11px] font-bold text-[color:var(--bk-teal-700,#0f766e)]">
                    {s.id}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group inline-flex flex-wrap items-baseline gap-x-2 text-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-teal-700,#0f766e)]"
                  >
                    <span className="font-medium underline-offset-2 group-hover:underline">{s.title}</span>
                    <span className="text-[color:var(--bk-ink-soft,#334155)]">· {s.outlet}</span>
                    <ExternalLink size={13} strokeWidth={2} className="self-center opacity-50" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* À lire aussi */}
        {related.length > 0 && (
          <section className="mt-14" aria-labelledby="related-title">
            <h2
              id="related-title"
              className="font-hand text-[16px] uppercase tracking-wide text-[color:var(--bk-teal-700,#0f766e)]"
            >
              À lire aussi
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {related.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </section>
        )}

        {/* CTA — Bokari chat-turn card (every article ends on it) */}
        <BokariCTA question={`Explique-moi simplement : ${article.title}`} />
      </article>

      <footer className="border-t border-[color:var(--bk-ink,#0f172a)]/10 px-4 py-8 text-center text-[13px] text-[color:var(--bk-ink-soft,#334155)]">
        <span className="font-display text-[color:var(--bk-ink,#0f172a)]">Bokari</span> · Une création
        Dicken AI · Ousmane Dicko · 2026
      </footer>
    </div>
  );
};

export default BkArticle;
