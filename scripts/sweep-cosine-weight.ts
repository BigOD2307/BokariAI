/**
 * @module scripts/sweep-cosine-weight
 * @description Run the eval at multiple cosine-weight values and
 * report the trade-off.  This is how we tune the ranker knob
 * `cosineWeight` (default 0.3) introduced in Phase 7.
 *
 * The sweep is a single-file artifact that we commit so future
 * readers can see what the trade-off looked like on this fixture.
 *
 * Usage:
 *   npx tsx scripts/sweep-cosine-weight.ts
 *   npx tsx scripts/sweep-cosine-weight.ts --out=docs/eval/2026-06-02-sweep.md
 *   npx tsx scripts/sweep-cosine-weight.ts --weights=0.0,0.2,0.3,0.5,0.7
 *
 * Default weights: 0.0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0.
 * Weight 0.0 = pure BM25, 1.0 = cosine-on-top-of-BM25.
 *
 * Output is a markdown table comparing NDCG@10, MRR, hit-rate@10
 * for each weight, and a final "best" pick.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FIXTURE_CORPUS_EMBEDDED } from '../src/lib/eval/fixture-embedded';
import { AFRICAN_EVAL_QUERIES } from '../src/lib/eval/dataset';
import { runEval, type EmbedFn } from '../src/lib/eval/runner';
import { readFileSync, existsSync } from 'node:fs';

function parseArgs() {
  const out: { outFile: string | null; weights: number[] } = {
    outFile: null,
    weights: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0],
  };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--out=')) out.outFile = arg.slice('--out='.length);
    if (arg.startsWith('--weights=')) {
      out.weights = arg.slice('--weights='.length).split(',').map(Number);
    }
  }
  return out;
}

function loadPrecomputedQueryEmbeddings(): EmbedFn | null {
  const path = resolve('docs/eval/query-embeddings.json');
  if (!existsSync(path)) return null;
  const cached = new Map(
    Object.entries(JSON.parse(readFileSync(path, 'utf-8')) as Record<string, number[]>),
  );
  return async (texts) =>
    texts.map((t) => {
      const v = cached.get(t);
      if (!v) throw new Error(`No precomputed embedding for "${t}"`);
      return v;
    });
}

function formatSweep(results: Array<{ weight: number; report: Awaited<ReturnType<typeof runEval>> }>): string {
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 10);
  lines.push(`# Bokari Citation Engine — Cosine Weight Sweep (${now})`);
  lines.push('');
  lines.push(`**Queries:** ${results[0]?.report.queries ?? 0}  `);
  lines.push(`**Corpus:** ${FIXTURE_CORPUS_EMBEDDED.length} articles  `);
  lines.push(`**K:** ${results[0]?.report.k ?? 10}  `);
  lines.push(`**Embedding model:** baai/bge-m3 (precomputed vectors)  `);
  lines.push('');
  lines.push('## Aggregate metrics by weight');
  lines.push('');
  lines.push('| Weight | NDCG@10 | MRR | Hit@10 | Δ vs BM25 (NDCG) |');
  lines.push('| --- | --- | --- | --- | --- |');
  const fmt = (x: number) => x.toFixed(3);
  const sign = (d: number) => (d >= 0 ? '+' : '');
  const baselineNdcg = results.find((r) => r.weight === 0)?.report.hybrid.ndcgAtK;
  for (const r of results) {
    const d = baselineNdcg !== undefined ? r.report.hybrid.ndcgAtK - baselineNdcg : 0;
    lines.push(
      `| ${r.weight.toFixed(2)} | ${fmt(r.report.hybrid.ndcgAtK)} | ${fmt(r.report.hybrid.mrr)} | ${fmt(r.report.hybrid.hitRateAtK)} | ${sign(d)}${d.toFixed(3)} |`,
    );
  }
  lines.push('');

  // Pick the best by NDCG@10.
  const best = results.reduce((a, b) =>
    b.report.hybrid.ndcgAtK > a.report.hybrid.ndcgAtK ? b : a,
  );
  lines.push('## Best');
  lines.push('');
  lines.push(`- **Best NDCG@10:** weight=${best.weight.toFixed(2)} → ${fmt(best.report.hybrid.ndcgAtK)}`);
  lines.push(`- **Best MRR:** weight=${
    results.reduce((a, b) => (b.report.hybrid.mrr > a.report.hybrid.mrr ? b : a)).weight.toFixed(2)
  } → ${fmt(results.reduce((a, b) => (b.report.hybrid.mrr > a.report.hybrid.mrr ? b : a)).report.hybrid.mrr)}`);
  lines.push(`- **Best Hit@10:** weight=${
    results.reduce((a, b) => (b.report.hybrid.hitRateAtK > a.report.hybrid.hitRateAtK ? b : a)).weight.toFixed(2)
  } → ${fmt(results.reduce((a, b) => (b.report.hybrid.hitRateAtK > a.report.hybrid.hitRateAtK ? b : a)).report.hybrid.hitRateAtK)}`);
  lines.push('');
  lines.push('## How to read this');
  lines.push('');
  lines.push('- **Weight 0.0** = pure BM25, no cosine blend.');
  lines.push('- **Weight 1.0** = full cosine-on-top-of-BM25 (cosine can dominate the score).');
  lines.push('- **Production default is 0.3** — cosine as a tie-breaker, BM25 as the backbone.');
  lines.push('- The best weight depends on how much you trust the embeddings to disambiguate');
  lines.push('  queries where BM25 ties (cross-language, paraphrase, etc.).');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs();
  const embedFn = loadPrecomputedQueryEmbeddings();
  if (!embedFn) {
    console.error('[sweep] docs/eval/query-embeddings.json not found.');
    console.error('[sweep] Run `npm run eval:precompute` first.');
    process.exit(2);
  }
  console.log(`[sweep] Using precomputed BGE-M3 vectors for ${AFRICAN_EVAL_QUERIES.length} queries.`);
  console.log(`[sweep] Sweeping weights: ${args.weights.join(', ')}`);

  const t0 = Date.now();
  const results: Array<{ weight: number; report: Awaited<ReturnType<typeof runEval>> }> = [];
  for (const w of args.weights) {
    const report = await runEval(FIXTURE_CORPUS_EMBEDDED, AFRICAN_EVAL_QUERIES, embedFn, { cosineWeight: w });
    results.push({ weight: w, report });
    console.log(
      `[sweep] w=${w.toFixed(2)}  NDCG=${report.hybrid.ndcgAtK.toFixed(3)}  MRR=${report.hybrid.mrr.toFixed(3)}  Hit=${report.hybrid.hitRateAtK.toFixed(3)}`,
    );
  }
  console.log(`[sweep] Done in ${Date.now() - t0}ms.`);

  const md = formatSweep(results);
  console.log('\n' + md);

  if (args.outFile) {
    const outPath = resolve(args.outFile);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, md, 'utf-8');
    console.log(`\n[sweep] Wrote report to ${outPath}`);
  }
}

main().catch((err) => {
  console.error('[sweep] failed:', err);
  process.exit(1);
});
