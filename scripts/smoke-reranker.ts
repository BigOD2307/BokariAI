/**
 * @module scripts/smoke-reranker
 * @description Live smoke test for the OpenRouterReranker.  Runs a
 * single 5-doc rerank call against the BGE-reranker-v2-m3 model
 * and prints the results.  Exits 0 on success.
 *
 * Usage:
 *   npx tsx scripts/smoke-reranker.ts
 *
 * Requires OPENROUTER_API_KEY in .env.  Costs ~$0.001 per run.
 *
 * @author Amadou — Dicken AI
 */
import { OpenRouterReranker, getRerankConfig } from '../src/lib/ai/reranker';

const QUERY = 'What is happening in Bamako Mali in 2026?';

const DOCS = [
  {
    id: 'a',
    text: 'Mali transitional government extends timeline for return to civilian rule. Bamako press conference.',
  },
  {
    id: 'b',
    text: 'Tourism in West Africa: a guide to Bamako markets and the Niger river.',
  },
  {
    id: 'c',
    text: 'Sahel security crisis: JNIM attacks continue across Mali, Burkina Faso and Niger.',
  },
  {
    id: 'd',
    text: 'African Union summit 2026 — what to expect from the Addis Ababa agenda.',
  },
  {
    id: 'e',
    text: 'Recipe for a traditional West African peanut stew with okra.',
  },
];

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[smoke-reranker] OPENROUTER_API_KEY is not set in env. Add it to .env first.');
    process.exit(2);
  }

  const cfg = getRerankConfig();
  console.log(`[smoke-reranker] Using model: ${cfg.model}`);
  const r = new OpenRouterReranker({ apiKey, model: cfg.model });
  const t0 = Date.now();
  const out = await r.rank(QUERY, DOCS);
  const ms = Date.now() - t0;

  console.log(`\n[smoke-reranker] Query: "${QUERY}"`);
  console.log(`[smoke-reranker] Rerank took ${ms}ms\n`);
  console.log('| id | score | index | snippet |');
  console.log('| --- | --- | --- | --- |');
  for (const x of out) {
    const doc = DOCS.find((d) => d.id === x.id);
    const snippet = (doc?.text || '').slice(0, 60) + '…';
    console.log(`| ${x.id} | ${x.score.toFixed(4)} | ${x.index} | ${snippet} |`);
  }

  if (out.length === 0) {
    console.error('[smoke-reranker] FAIL — no results returned');
    process.exit(1);
  }
  // The top result should be a "Mali" article (id=a, c, or b — anything
  // that mentions Bamako/Sahel/Mali), not a recipe (e) or AU (d).
  const topId = out[0]?.id;
  if (topId === 'e' || topId === 'd') {
    console.warn(`[smoke-reranker] WARN — top result is "${topId}", which doesn't mention Mali.`);
    console.warn('[smoke-reranker] This may be a model issue; rerank is still working.');
  }
  console.log('\n[smoke-reranker] OK');
}

main().catch((err) => {
  console.error('[smoke-reranker] FAIL:', err);
  process.exit(1);
});
