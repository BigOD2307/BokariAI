/**
 * @module scripts/precompute-query-embeddings
 * @description Compute BGE-M3 embeddings for every query in the
 * African eval set, then save them to `docs/eval/query-embeddings.json`.
 *
 * Why: lets the CI gate (and the offline / precomputed eval modes)
 * run the *full* hybrid eval — including cross-language cosine —
 * without an OpenRouter API call.  The fixture articles already
 * have BGE-M3 vectors baked in (`fixture-embedded.ts`); this script
 * is the query-side counterpart.
 *
 * Idempotent: re-running overwrites the file.  Run after adding
 * new queries to the dataset.
 *
 * Usage:
 *   OPENROUTER_API_KEY=… npx tsx scripts/precompute-query-embeddings.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AFRICAN_EVAL_QUERIES } from '../src/lib/eval/dataset';
import { embed } from '../src/lib/ai/gateway';

async function main() {
  const queries = AFRICAN_EVAL_QUERIES.map((q) => q.query);
  console.log(`[precompute] Embedding ${queries.length} queries via BGE-M3 (OpenRouter)…`);
  const t0 = Date.now();
  const vectors = await embed(queries);
  console.log(`[precompute] Done in ${Date.now() - t0}ms.`);

  const out: Record<string, number[]> = {};
  for (let i = 0; i < queries.length; i++) {
    out[queries[i]!] = vectors[i]!;
  }

  const outPath = resolve('docs/eval/query-embeddings.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 0) + '\n', 'utf-8');
  console.log(`[precompute] Wrote ${outPath}`);
  console.log(`[precompute] Total queries: ${queries.length}`);
  console.log(`[precompute] Total dimensions: ${vectors[0]?.length ?? 0}`);
}

main().catch((err) => {
  console.error('[precompute] failed:', err);
  process.exit(1);
});
