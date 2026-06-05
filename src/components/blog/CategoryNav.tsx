import Link from 'next/link';
import { CATEGORIES } from '@/lib/blog/categories';

/**
 * CategoryNav — the rubrique browser: a "Tout" chip (back to /blog) plus one
 * chip per category. The active category lights up in its own accent; the rest
 * are calm ink-outlined chips.
 */
const CategoryNav = ({ activeSlug }: { activeSlug?: string }) => {
  const tout = !activeSlug;
  return (
    <nav aria-label="Catégories du blog" className="flex flex-wrap gap-2">
      <Link
        href="/blog"
        aria-current={tout ? 'page' : undefined}
        className={`font-hand rounded-full border-2 px-3.5 py-1 text-[14px] uppercase tracking-wide transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] ${
          tout
            ? 'border-[color:var(--bk-teal-700,#0f766e)] bg-[color:var(--bk-teal,#14b8a6)] text-white shadow-[0_2px_0_var(--bk-teal-700,#0f766e)]'
            : 'border-[color:var(--bk-ink,#0f172a)]/15 text-[color:var(--bk-ink-soft,#334155)] hover:border-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-ink,#0f172a)]'
        }`}
      >
        Tout
      </Link>

      {CATEGORIES.map((c) => {
        const active = c.slug === activeSlug;
        return (
          <Link
            key={c.slug}
            href={`/blog/categorie/${c.slug}`}
            aria-current={active ? 'page' : undefined}
            style={active ? { backgroundColor: c.tint, borderColor: c.edge, color: c.ink } : undefined}
            className={`font-hand rounded-full border-2 px-3.5 py-1 text-[14px] uppercase tracking-wide transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] ${
              active
                ? ''
                : 'border-[color:var(--bk-ink,#0f172a)]/15 text-[color:var(--bk-ink-soft,#334155)] hover:border-[color:var(--bk-ink,#0f172a)] hover:text-[color:var(--bk-ink,#0f172a)]'
            }`}
          >
            {c.short ?? c.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default CategoryNav;
