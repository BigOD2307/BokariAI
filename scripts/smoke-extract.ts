/**
 * Live smoke test: hit a real African news URL and verify the extractor
 * returns markdown + metadata.  Run with:
 *
 *   npx tsx scripts/smoke-extract.ts
 *
 * or via the test runner:
 *
 *   npm test -- tests/discover/smoke-extract.live.test.ts
 */

import { extractArticle } from '../src/lib/discover/contentExtractor';

const URLS = [
  'https://www.rfi.fr/fr/afrique/',
  'https://www.thecable.ng/',
  'https://www.bbc.com/afrique',
  'https://www.france24.com/fr/afrique/',
];

async function main() {
  for (const url of URLS) {
    console.log(`\n=== ${url} ===`);
    const r = await extractArticle(url, { timeoutMs: 10_000 });
    if (!r.success) {
      console.log(`FAIL: ${r.error}`);
      continue;
    }
    console.log(`author:           ${r.metadata.author ?? '(none)'}`);
    console.log(`publishedAt:      ${r.metadata.publishedAt?.toISOString() ?? '(none)'}`);
    console.log(`canonicalUrl:     ${r.metadata.canonicalUrl ?? '(none)'}`);
    console.log(`fullContent len:  ${r.fullContent?.length ?? 0}`);
    console.log(`contentHash:      ${r.contentHash?.slice(0, 16)}…`);
    console.log(`first 200 chars:  ${r.fullContent?.slice(0, 200).replace(/\n/g, ' ')}…`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
