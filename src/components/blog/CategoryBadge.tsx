import Link from 'next/link';
import type { Category } from '@/lib/blog/categories';

type Props = {
  category: Category;
  /** Link to the category page instead of a static tag. */
  href?: string;
  /** Use the short label (for tight rows). */
  short?: boolean;
  className?: string;
};

/**
 * CategoryBadge — a small rubrique tag in the category's own accent (tint + edge
 * + ink). Static `<span>` by default; pass `href` to make it a link.
 */
const CategoryBadge = ({ category, href, short, className }: Props) => {
  const style = {
    backgroundColor: category.tint,
    borderColor: category.edge,
    color: category.ink,
  };
  const label = short ? category.short ?? category.label : category.label;
  const base =
    'font-hand inline-flex w-fit items-center rounded-full border-2 px-3 py-0.5 text-[13px] uppercase tracking-wide';

  if (href) {
    return (
      <Link
        href={href}
        style={style}
        className={`${base} transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--bk-teal,#14b8a6)] focus-visible:ring-offset-1 ${className ?? ''}`}
      >
        {label}
      </Link>
    );
  }
  return (
    <span style={style} className={`${base} ${className ?? ''}`}>
      {label}
    </span>
  );
};

export default CategoryBadge;
