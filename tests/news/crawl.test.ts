/**
 * Unit tests for the C9 feed parser: RSS 2.0, Atom, RDF, CDATA titles,
 * guid-only links, malformed dates. The parser is where flaky feeds break
 * first, so every real-world quirk we saw gets a case here.
 */
import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';
import { parseFeedXml } from '@/lib/news/crawl';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
});

const parse = (xml: string) => parseFeedXml(parser.parse(xml));

describe('parseFeedXml', () => {
  it('parses a plain RSS 2.0 feed', () => {
    const items = parse(`<?xml version="1.0"?>
      <rss><channel>
        <item><title>Le Mali gagne</title><link>https://lefaso.net/a1</link><pubDate>Tue, 09 Sep 2026 10:00:00 GMT</pubDate></item>
        <item><title>Second article</title><link>https://lefaso.net/a2</link><pubDate>Tue, 09 Sep 2026 09:00:00 GMT</pubDate></item>
      </channel></rss>`);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      title: 'Le Mali gagne',
      link: 'https://lefaso.net/a1',
      publishedAt: new Date('Tue, 09 Sep 2026 10:00:00 GMT'),
    });
  });

  it('parses an Atom feed with href links', () => {
    const items = parse(`<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Actualite.cd</title>
          <link href="https://actualite.cd/n1" rel="alternate"/>
          <published>2026-09-09T08:30:00Z</published>
        </entry>
      </feed>`);
    expect(items).toHaveLength(1);
    expect(items[0].link).toBe('https://actualite.cd/n1');
    expect(items[0].publishedAt?.toISOString()).toBe(
      '2026-09-09T08:30:00.000Z',
    );
  });

  it('parses an RDF (RSS 1.0) feed', () => {
    const items = parse(`<?xml version="1.0"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/">
        <channel rdf:about="https://x"/>
        <item><title>RDF item</title><link>https://x/rdf1</link><dc:date>2026-09-09T07:00:00Z</dc:date></item>
      </rdf:RDF>`);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('RDF item');
  });

  it('falls back to guid when link is missing', () => {
    const items = parse(`<rss><channel>
      <item><title>guid only</title><guid>https://example.com/g1</guid></item>
    </channel></rss>`);
    expect(items[0].link).toBe('https://example.com/g1');
  });

  it('drops entries with no link or no title', () => {
    const items = parse(`<rss><channel>
      <item><title>no link</title></item>
      <item><link>https://x/n1</link></item>
      <item><title>ok</title><link>https://x/n2</link></item>
    </channel></rss>`);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('ok');
  });

  it('keeps items with a malformed or missing date (publishedAt null)', () => {
    const items = parse(`<rss><channel>
      <item><title>bad date</title><link>https://x/b1</link><pubDate>not a date</pubDate></item>
      <item><title>no date</title><link>https://x/b2</link></item>
    </channel></rss>`);
    expect(items).toHaveLength(2);
    expect(items[0].publishedAt).toBeNull();
    expect(items[1].publishedAt).toBeNull();
  });

  it('handles a single-item feed (no array)', () => {
    const items = parse(`<rss><channel>
      <item><title>only one</title><link>https://x/one</link></item>
    </channel></rss>`);
    expect(items).toHaveLength(1);
  });

  it('returns empty for an unknown feed shape (never throws)', () => {
    expect(parseFeedXml({})).toEqual([]);
    expect(parseFeedXml(null)).toEqual([]);
    expect(parseFeedXml({ rss: {} })).toEqual([]);
  });
});
