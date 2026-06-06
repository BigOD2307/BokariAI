/**
 * Bokari blog — article model + the public read API.
 *
 * Articles now live in SQLite (table `articles`, migration 0009) so the
 * autonomous generator can write drafts and the admin can publish them. The
 * `Article` shape below is unchanged, so the blog pages and card components
 * keep rendering exactly as before — only the read functions became `async`.
 *
 * On first use (empty table) the original editorial set is seeded as published
 * content (see ./seed) so the blog is never blank on a fresh deploy.
 *
 * `category` is a Category slug (see ./categories). `featured` marks the "À la
 * une" pick; if none is flagged, the most recent article is used.
 */
import {
  listArticles,
  getPublishedBySlug,
  relatedPublished,
  insertArticle,
  countArticles,
  type StoredArticle,
} from './store';
import { SEED_ARTICLES } from './seed';

export type ArticleSource = {
  id: number;
  title: string;
  outlet: string;
  url: string;
};

export type Article = {
  slug: string;
  /** Category slug — see src/lib/blog/categories.ts. */
  category: string;
  title: string;
  /** One-sentence dek shown under the title and used as meta description. */
  excerpt: string;
  /** Markdown body. Inline citations use [n] that map to `sources`. */
  body: string;
  sources: ArticleSource[];
  /** ISO date. */
  publishedAt: string;
  readingMinutes: number;
  author: string;
  /** Editorial "À la une" pick. At most one should be true. */
  featured?: boolean;
  /** Optional cover image URL. */
  coverImage?: string;
};

function toArticle(s: StoredArticle): Article {
  return {
    slug: s.slug,
    category: s.category,
    title: s.title,
    excerpt: s.excerpt,
    body: s.body,
    sources: s.sources,
    publishedAt: s.publishedAt ?? s.createdAt,
    readingMinutes: s.readingMinutes,
    author: s.author,
    featured: s.featured,
    coverImage: s.coverImage ?? undefined,
  };
}

// One-time seed guard, memoized per process.
let seedPromise: Promise<void> | null = null;
async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      try {
        const total = await countArticles();
        if (total > 0) return;
        for (const a of SEED_ARTICLES) {
          await insertArticle(a);
        }
      } catch (err) {
        // Don't wedge the blog if seeding fails (e.g. read-only FS in build).
        console.error('[blog] seed failed:', err);
        seedPromise = null;
      }
    })();
  }
  return seedPromise;
}

export async function getAllArticles(): Promise<Article[]> {
  await ensureSeeded();
  const rows = await listArticles({ status: 'published' });
  return rows.map(toArticle);
}

export async function getArticle(slug: string): Promise<Article | undefined> {
  await ensureSeeded();
  const row = await getPublishedBySlug(slug);
  return row ? toArticle(row) : undefined;
}

export async function getArticleSlugs(): Promise<string[]> {
  await ensureSeeded();
  const rows = await listArticles({ status: 'published' });
  return rows.map((r) => r.slug);
}

/** Articles in a category (most recent first). */
export async function getArticlesByCategory(categorySlug: string): Promise<Article[]> {
  await ensureSeeded();
  const rows = await listArticles({ status: 'published', category: categorySlug });
  return rows.map(toArticle);
}

/** The "À la une" pick: the flagged article, else the most recent. */
export async function getFeaturedArticle(): Promise<Article | undefined> {
  const all = await getAllArticles();
  return all.find((a) => a.featured) ?? all[0];
}

/** Up to `limit` other published articles in the same category (excluding `slug`). */
export async function getRelatedArticles(
  slug: string,
  categorySlug: string,
  limit = 3,
): Promise<Article[]> {
  await ensureSeeded();
  const rows = await relatedPublished(categorySlug, slug, limit);
  return rows.map(toArticle);
}
