/**
 * Blog article store — SQLite-backed (table `articles`, migration 0009).
 *
 * This is the seam the static `articles.ts` always promised: same `Article`
 * shape on the read side, but rows now live in the local SQLite DB so the
 * autonomous generator can write drafts and the admin can publish them. Public
 * pages read `status = 'published'`; the review queue reads `'draft'`.
 */
import { all, get, run } from '@/lib/db/sqlite';
import type { ArticleSource } from './articles';

export type ArticleStatus = 'draft' | 'published' | 'rejected';
export type ArticleOrigin = 'auto' | 'seed' | 'manual';

export type StoredArticle = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  sources: ArticleSource[];
  status: ArticleStatus;
  readingMinutes: number;
  author: string;
  featured: boolean;
  origin: ArticleOrigin;
  generatedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image: string | null;
  sources: string;
  status: string;
  reading_minutes: number;
  author: string;
  featured: number;
  origin: string;
  generated_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Row): StoredArticle {
  let sources: ArticleSource[] = [];
  try {
    sources = JSON.parse(r.sources || '[]');
  } catch {
    sources = [];
  }
  return {
    id: r.id,
    slug: r.slug,
    category: r.category,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    coverImage: r.cover_image,
    sources,
    status: r.status as ArticleStatus,
    readingMinutes: r.reading_minutes,
    author: r.author,
    featured: !!r.featured,
    origin: r.origin as ArticleOrigin,
    generatedAt: r.generated_at,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

export function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}

/** 20-byte hex id, same scheme as chats. */
function genId(): string {
  // crypto is available in the Node runtime; avoid Math.random for ids.
  const { randomBytes } = require('crypto');
  return randomBytes(16).toString('hex');
}

export async function slugExists(slug: string): Promise<boolean> {
  const row = await get<{ n: number }>(
    'SELECT COUNT(*) AS n FROM articles WHERE slug = ?',
    [slug],
  );
  return (row?.n ?? 0) > 0;
}

/** Make `base` unique by appending -2, -3, … if needed. */
export async function uniqueSlug(base: string): Promise<string> {
  let slug = base || genId().slice(0, 8);
  let i = 2;
  while (await slugExists(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  return slug;
}

export type NewArticleInput = {
  slug?: string;
  category: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string | null;
  sources?: ArticleSource[];
  status?: ArticleStatus;
  author?: string;
  featured?: boolean;
  origin?: ArticleOrigin;
  /** Override publish date (used when seeding historical articles). */
  publishedAt?: string;
  readingMinutes?: number;
};

export async function insertArticle(input: NewArticleInput): Promise<StoredArticle> {
  const now = new Date().toISOString();
  const id = genId();
  const baseSlug = input.slug ? slugify(input.slug) : slugify(input.title);
  const slug = await uniqueSlug(baseSlug);
  const status = input.status ?? 'draft';
  const readingMinutes = input.readingMinutes ?? estimateReadingMinutes(input.body);
  const publishedAt =
    status === 'published' ? (input.publishedAt ?? now) : null;

  await run(
    `INSERT INTO articles
       (id, slug, category, title, excerpt, body, cover_image, sources, status,
        reading_minutes, author, featured, origin, generated_at, published_at,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      slug,
      input.category,
      input.title,
      input.excerpt,
      input.body,
      input.coverImage ?? null,
      JSON.stringify(input.sources ?? []),
      status,
      readingMinutes,
      input.author ?? 'Bokari',
      input.featured ? 1 : 0,
      input.origin ?? 'auto',
      now,
      publishedAt,
      now,
      now,
    ],
  );

  const created = await getArticleById(id);
  if (!created) throw new Error('[blog/store] insert failed to read back');
  return created;
}

export async function getArticleById(id: string): Promise<StoredArticle | null> {
  const row = await get<Row>('SELECT * FROM articles WHERE id = ?', [id]);
  return row ? mapRow(row) : null;
}

export async function getPublishedBySlug(slug: string): Promise<StoredArticle | null> {
  const row = await get<Row>(
    "SELECT * FROM articles WHERE slug = ? AND status = 'published'",
    [slug],
  );
  return row ? mapRow(row) : null;
}

export type ListOpts = {
  status?: ArticleStatus;
  category?: string;
  limit?: number;
};

export async function listArticles(opts: ListOpts = {}): Promise<StoredArticle[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push('status = ?');
    params.push(opts.status);
  }
  if (opts.category) {
    where.push('category = ?');
    params.push(opts.category);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  // Published first by publish date, drafts by generation date — coalesce so
  // both orderings are sensible.
  const limitSql = opts.limit ? `LIMIT ${Math.max(1, Math.floor(opts.limit))}` : '';
  const rows = await all<Row>(
    `SELECT * FROM articles ${whereSql}
       ORDER BY COALESCE(published_at, generated_at, created_at) DESC
       ${limitSql}`,
    params,
  );
  return rows.map(mapRow);
}

export async function setArticleStatus(
  id: string,
  status: ArticleStatus,
): Promise<void> {
  const now = new Date().toISOString();
  // Stamp published_at the first time it goes live; keep it on re-publish.
  await run(
    `UPDATE articles
       SET status = ?,
           published_at = CASE
             WHEN ? = 'published' AND published_at IS NULL THEN ?
             ELSE published_at
           END,
           updated_at = ?
     WHERE id = ?`,
    [status, status, now, now, id],
  );
}

export async function updateArticleContent(
  id: string,
  patch: Partial<Pick<StoredArticle, 'title' | 'excerpt' | 'body' | 'category' | 'coverImage'>>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.title !== undefined) {
    sets.push('title = ?');
    params.push(patch.title);
  }
  if (patch.excerpt !== undefined) {
    sets.push('excerpt = ?');
    params.push(patch.excerpt);
  }
  if (patch.body !== undefined) {
    sets.push('body = ?', 'reading_minutes = ?');
    params.push(patch.body, estimateReadingMinutes(patch.body));
  }
  if (patch.category !== undefined) {
    sets.push('category = ?');
    params.push(patch.category);
  }
  if (patch.coverImage !== undefined) {
    sets.push('cover_image = ?');
    params.push(patch.coverImage);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);
  await run(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function countArticles(status?: ArticleStatus): Promise<number> {
  const row = status
    ? await get<{ n: number }>('SELECT COUNT(*) AS n FROM articles WHERE status = ?', [status])
    : await get<{ n: number }>('SELECT COUNT(*) AS n FROM articles');
  return row?.n ?? 0;
}

/** Most recent published article in a category (skip a slug), for "à lire aussi". */
export async function relatedPublished(
  category: string,
  excludeSlug: string,
  limit = 3,
): Promise<StoredArticle[]> {
  const rows = await all<Row>(
    `SELECT * FROM articles
       WHERE status = 'published' AND category = ? AND slug != ?
       ORDER BY COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    [category, excludeSlug, limit],
  );
  return rows.map(mapRow);
}
