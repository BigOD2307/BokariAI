import { listArticles } from '@/lib/blog/store';

export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'https://bokari.space';

/**
 * Blog RSS 2.0 feed — the syndication surface C10 requires. Published articles
 * only, newest first, links absolute. The excerpt is the description; the body
 * stays on-site (content:encoded full text would be republishing).
 */
export async function GET() {
  let articles: Awaited<ReturnType<typeof listArticles>> = [];
  try {
    articles = await listArticles({ status: 'published', limit: 30 });
  } catch {
    // An empty feed beats a 500 — subscribers keep polling.
  }

  const items = articles
    .map(
      (a) => `    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${BASE}/blog/${a.slug}</link>
      <guid isPermaLink="true">${BASE}/blog/${a.slug}</guid>
      <pubDate>${new Date(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Bokari — Le journal IA africain</title>
    <link>${BASE}/blog</link>
    <description>L'actualité africaine vérifiée, sourcée et datée, rédigée et revue automatiquement.</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=1800',
    },
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
