import { describe, it, expect } from 'vitest';
import { extractMetadata } from '@/lib/discover/metadataExtractor';

describe('extractMetadata — JSON-LD', () => {
  it('extracts author and datePublished from a NewsArticle JSON-LD block', () => {
    const html = `
      <!doctype html>
      <html><head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": "Coup d'État à Bamako",
          "author": { "@type": "Person", "name": "Aminata Traoré" },
          "datePublished": "2026-05-20T08:30:00+00:00"
        }
        </script>
      </head><body><article><p>...</p></article></body></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Aminata Traoré');
    expect(meta.publishedAt).toBeInstanceOf(Date);
    expect(meta.publishedAt?.toISOString()).toBe('2026-05-20T08:30:00.000Z');
  });

  it('extracts from an Article JSON-LD block (not just NewsArticle)', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "Article", "author": "Moussa Konaté", "datePublished": "2026-04-01" }
        </script>
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Moussa Konaté');
    expect(meta.publishedAt?.toISOString()).toContain('2026-04-01');
  });

  it('handles JSON-LD with author as a plain string', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "NewsArticle", "author": "Le Monde", "datePublished": "2026-05-15" }
        </script>
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Le Monde');
  });

  it('picks the first matching JSON-LD block when multiple exist', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "WebSite", "name": "RFI" }
        </script>
        <script type="application/ld+json">
        { "@type": "NewsArticle", "author": "Papa Diouf", "datePublished": "2026-03-10" }
        </script>
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Papa Diouf');
  });

  it('returns null fields when JSON-LD has no author or datePublished', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "BreadcrumbList" }
        </script>
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBeNull();
    expect(meta.publishedAt).toBeNull();
  });

  it('skips malformed JSON-LD gracefully', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { broken json,,
        </script>
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBeNull();
    expect(meta.publishedAt).toBeNull();
  });
});

describe('extractMetadata — OpenGraph', () => {
  it('extracts author from og:article:author when no JSON-LD', () => {
    const html = `
      <html><head>
        <meta property="article:author" content="Fatou Sissoko" />
        <meta property="article:published_time" content="2026-05-10T14:00:00Z" />
      </head><body><article><p>content</p></article></body></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Fatou Sissoko');
    expect(meta.publishedAt?.toISOString()).toBe('2026-05-10T14:00:00.000Z');
  });

  it('falls back to plain meta name=author when no og:', () => {
    const html = `
      <html><head>
        <meta name="author" content="Jean Dupont" />
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('Jean Dupont');
  });

  it('falls back to twitter:creator for author', () => {
    const html = `
      <html><head>
        <meta name="twitter:creator" content="@rfi_afrique" />
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('@rfi_afrique');
  });
});

describe('extractMetadata — <time> tag', () => {
  it('extracts datetime attribute from <time> in <article>', () => {
    const html = `
      <html><body>
        <article>
          <p>Lorem ipsum.</p>
          <time datetime="2026-05-12T09:00:00+00:00">12 mai 2026</time>
        </article>
      </body></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.publishedAt?.toISOString()).toBe('2026-05-12T09:00:00.000Z');
  });
});

describe('extractMetadata — priority order', () => {
  it('JSON-LD wins over og: when both exist', () => {
    const html = `
      <html><head>
        <script type="application/ld+json">
        { "@type": "NewsArticle", "author": "JSON-LD Author", "datePublished": "2026-01-01" }
        </script>
        <meta property="article:author" content="OG Author" />
        <meta property="article:published_time" content="2026-02-02" />
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('JSON-LD Author');
    expect(meta.publishedAt?.toISOString()).toContain('2026-01-01');
  });

  it('og: wins over plain meta when no JSON-LD', () => {
    const html = `
      <html><head>
        <meta property="article:author" content="OG Author" />
        <meta name="author" content="Plain Author" />
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.author).toBe('OG Author');
  });
});

describe('extractMetadata — empty / pathological', () => {
  it('returns all nulls for empty html', () => {
    const meta = extractMetadata('');
    expect(meta).toEqual({ author: null, publishedAt: null, canonicalUrl: null });
  });

  it('returns all nulls for html with no metadata', () => {
    const html = '<html><body><article><p>plain article</p></article></body></html>';
    const meta = extractMetadata(html);
    expect(meta.author).toBeNull();
    expect(meta.publishedAt).toBeNull();
  });

  it('extracts canonicalUrl from <link rel="canonical">', () => {
    const html = `
      <html><head>
        <link rel="canonical" href="https://example.com/article-123" />
      </head></html>
    `;
    const meta = extractMetadata(html);
    expect(meta.canonicalUrl).toBe('https://example.com/article-123');
  });
});
