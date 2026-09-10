import type { MetadataRoute } from 'next';
import { listArticles } from '@/lib/blog/store';
import { CATEGORIES } from '@/lib/blog/categories';

export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bokari.space';

/**
 * Blog sitemap — published articles + category pages + the blog index.
 * Part of C10's acceptance criteria (indexable content, valid sitemap).
 */
export async function GET(): Promise<Response> {
  let articles: Awaited<ReturnType<typeof listArticles>> = [];
  try {
    articles = await listArticles({ status: 'published', limit: 500 });
  } catch {
    /* static pages still ship if the DB hiccups */
  }

  const staticPages = [
    { url: `${BASE}/blog`, priority: 0.9 },
    ...CATEGORIES.map((c) => ({
      url: `${BASE}/blog/categorie/${c.slug}`,
      priority: 0.6,
    })),
  ];

  const urls = [
    ...staticPages,
    ...articles.map((a) => ({
      url: `${BASE}/blog/${a.slug}`,
      lastModified: new Date(a.updatedAt ?? a.createdAt),
      priority: 0.7,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => {
    const lm =
      'lastModified' in u && u.lastModified
        ? `\n    <lastmod>${new Date(u.lastModified as Date).toISOString()}</lastmod>`
        : '';
    return `  <url>\n    <loc>${u.url}</loc>${lm}\n    <priority>${u.priority}</priority>\n  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
