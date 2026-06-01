/**
 * Extract article metadata from HTML for proper citation.
 *
 * Sources, in priority order:
 *   1. JSON-LD  <script type="application/ld+json">  (NewsArticle / Article)
 *   2. OpenGraph  <meta property="article:*">
 *   3. Twitter Card  <meta name="twitter:creator">  (author only)
 *   4. Plain meta  <meta name="author">
 *   5. <time datetime="..."> in <article> or <main>
 *
 * Returns whatever we can find.  All fields are nullable.  We never throw —
 * malformed HTML is treated as "no metadata found" so the caller can still
 * store the snippet.
 */

export type ArticleMetadata = {
  author: string | null;
  publishedAt: Date | null;
  canonicalUrl: string | null;
};

type JsonLdObject = {
  '@type'?: string | string[];
  author?: string | { name?: string } | Array<string | { name?: string }>;
  datePublished?: string;
  dateCreated?: string;
};

function isArticleLike(type: string | string[] | undefined): boolean {
  if (!type) return false;
  if (Array.isArray(type)) {
    return type.some((t) => isArticleLike(t));
  }
  const t = type.toLowerCase();
  return t === 'newsarticle' || t === 'article' || t === 'report' || t === 'blogposting';
}

function authorFromJsonLd(author: JsonLdObject['author']): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author.trim() || null;
  if (Array.isArray(author)) {
    for (const a of author) {
      const v = authorFromJsonLd(a);
      if (v) return v;
    }
    return null;
  }
  return author.name?.trim() || null;
}

function parseJsonLdBlocks(html: string): JsonLdObject[] {
  const blocks: JsonLdObject[] = [];
  const re = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      // schema.org sometimes uses @graph: { "@graph": [ {...}, {...} ] }
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed['@graph'])) {
          for (const g of parsed['@graph']) {
            if (g && typeof g === 'object') blocks.push(g as JsonLdObject);
          }
        } else {
          blocks.push(parsed as JsonLdObject);
        }
      }
    } catch {
      // ignore malformed block
    }
  }
  return blocks;
}

function fromJsonLd(html: string): ArticleMetadata | null {
  const blocks = parseJsonLdBlocks(html);
  for (const b of blocks) {
    if (!isArticleLike(b['@type'])) continue;
    const author = authorFromJsonLd(b.author);
    const dateStr = b.datePublished ?? b.dateCreated ?? null;
    const publishedAt = dateStr ? safeDate(dateStr) : null;
    if (author || publishedAt) {
      return { author, publishedAt, canonicalUrl: null };
    }
  }
  return null;
}

function safeDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  return d;
}

function metaContent(html: string, attr: 'name' | 'property', value: string): string | null {
  // <meta name="author" content="..."> or <meta property="og:..." content="...">
  const re = new RegExp(
    `<meta\\s+[^>]*${attr}=["']${value}["'][^>]*content=["']([^"']*)["']`,
    'i',
  );
  const m = html.match(re);
  if (m) return m[1].trim();
  // Try attribute order swapped
  const re2 = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value}["']`,
    'i',
  );
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : null;
}

function fromOpenGraph(html: string): ArticleMetadata {
  const author =
    metaContent(html, 'property', 'article:author') ??
    metaContent(html, 'name', 'twitter:creator') ??
    metaContent(html, 'name', 'author');

  const publishedAtRaw =
    metaContent(html, 'property', 'article:published_time') ??
    metaContent(html, 'property', 'og:published_time') ??
    metaContent(html, 'name', 'pubdate') ??
    metaContent(html, 'name', 'publishdate');

  return {
    author: author?.trim() || null,
    publishedAt: publishedAtRaw ? safeDate(publishedAtRaw) : null,
    canonicalUrl: null,
  };
}

function fromTimeTag(html: string): Date | null {
  // <time datetime="2026-05-12T09:00:00Z">
  const re = /<time[^>]*\sdatetime=["']([^"']+)["']/i;
  const m = html.match(re);
  if (!m) return null;
  return safeDate(m[1]);
}

function fromCanonical(html: string): string | null {
  const re = /<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i;
  const m = html.match(re);
  if (m) return m[1].trim();
  const re2 = /<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i;
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : null;
}

export function extractMetadata(html: string): ArticleMetadata {
  if (!html || typeof html !== 'string') {
    return { author: null, publishedAt: null, canonicalUrl: null };
  }

  // 1. JSON-LD
  const jsonLd = fromJsonLd(html);
  // 2. OpenGraph
  const og = fromOpenGraph(html);
  // 3. <time> tag (publishedAt only)
  const time = fromTimeTag(html);
  // 4. canonical URL
  const canonical = fromCanonical(html);

  return {
    author: jsonLd?.author ?? og.author,
    publishedAt: jsonLd?.publishedAt ?? og.publishedAt ?? time,
    canonicalUrl: canonical,
  };
}
