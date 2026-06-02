/**
 * @module scripts/check-retrieval
 * @description CI gate: run the eval, compare to the baseline
 * (docs/eval/baseline.json), and fail the build if any metric drops
 * by more than the configured threshold.
 *
 * This is the *pre-deploy gate* promised in PHASE-5-EVAL-HARNESS.md.
 * Any change to `src/lib/discover/*` or `src/lib/ai/*` that hurts
 * retrieval by more than `--threshold=0.02` will fail CI.
 *
 * Usage:
 *   npx tsx scripts/check-retrieval.ts
 *   npx tsx scripts/check-retrieval.ts --offline
 *   npx tsx scripts/check-retrieval.ts --threshold=0.05
 *   npx tsx scripts/check-retrieval.ts --update-baseline
 *
 * The baseline lives at `docs/eval/baseline.json` and is updated
 * manually (or via `--update-baseline`) when the eval is intentionally
 * improved.  Threshold defaults to 0.02 (NDCG@10 / MRR / hit-rate).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FIXTURE_CORPUS_EMBEDDED } from '../src/lib/eval/fixture-embedded';
import { AFRICAN_EVAL_QUERIES } from '../src/lib/eval/dataset';
import { runEval } from '../src/lib/eval/runner';
import { embed } from '../src/lib/ai/gateway';

const args = process.argv.slice(2);
function arg(flag: string, fallback: string | null = null): string | null {
  const a = args.find((a) => a.startsWith(flag));
  if (!a) return fallback;
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  return args[args.indexOf(a) + 1] ?? fallback;
}

const offline = args.includes('--offline');
const updateBaseline = args.includes('--update-baseline');
const threshold = Number(arg('--threshold', '0.02'));
const baselinePath = resolve('docs/eval/baseline.json');

type Baseline = {
  bm25Only: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  hybrid: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  queries: number;
  corpusSize: number;
  k: number;
  model: string;
  recordedAt: string;
};

function unitVector(dim: number): number[] {
  // Deterministic unit vector for offline mode.
  const v = new Array<number>(dim).fill(0);
  v[0] = 1;
  return v;
}

async function main() {
  console.log('[check-retrieval] Running eval…');
  const t0 = Date.now();
  const embedFn = offline
    ? async (inputs: string[]): Promise<number[][]> => inputs.map(() => unitVector(1024))
    : embed;
  const report = await runEval(
    FIXTURE_CORPUS_EMBEDDED,
    AFRICAN_EVAL_QUERIES,
    embedFn,
  );
  console.log(`[check-retrieval] Done in ${Date.now() - t0}ms.`);

  const current: Baseline = {
    bm25Only: report.bm25Only,
    hybrid: report.hybrid,
    queries: report.queries,
    corpusSize: FIXTURE_CORPUS_EMBEDDED.length,
    k: report.k,
    model: offline ? 'unit-vector' : 'baai/bge-m3',
    recordedAt: new Date().toISOString(),
  };

  console.log('\n[check-retrieval] Current metrics:');
  console.log(`  BM25-only  NDCG@${current.k}: ${current.bm25Only.ndcgAtK.toFixed(3)}  MRR: ${current.bm25Only.mrr.toFixed(3)}  Hit: ${current.bm25Only.hitRateAtK.toFixed(3)}`);
  console.log(`  Hybrid     NDCG@${current.k}: ${current.hybrid.ndcgAtK.toFixed(3)}  MRR: ${current.hybrid.mrr.toFixed(3)}  Hit: ${current.hybrid.hitRateAtK.toFixed(3)}`);

  if (updateBaseline) {
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n', 'utf-8');
    console.log(`\n[check-retrieval] Baseline written to ${baselinePath}`);
    return;
  }

  if (!existsSync(baselinePath)) {
    console.error(`\n[check-retrieval] No baseline at ${baselinePath}.`);
    console.error(`[check-retrieval] Run with --update-baseline to create one.`);
    process.exit(2);
  }

  const baseline: Baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  console.log(`\n[check-retrieval] Baseline (${baseline.recordedAt}):`);
  console.log(`  BM25-only  NDCG@${baseline.k}: ${baseline.bm25Only.ndcgAtK.toFixed(3)}  MRR: ${baseline.bm25Only.mrr.toFixed(3)}  Hit: ${baseline.bm25Only.hitRateAtK.toFixed(3)}`);
  console.log(`  Hybrid     NDCG@${baseline.k}: ${baseline.hybrid.ndcgAtK.toFixed(3)}  MRR: ${baseline.hybrid.mrr.toFixed(3)}  Hit: ${baseline.hybrid.hitRateAtK.toFixed(3)}`);

  // Per-metric deltas.  The hybrid is the metric we care about —
  // BM25-only is informational.
  const deltas: Array<{ metric: string; baseline: number; current: number; drop: number }> = [
    { metric: 'hybrid.ndcg', baseline: baseline.hybrid.ndcgAtK, current: current.hybrid.ndcgAtK, drop: 0 },
    { metric: 'hybrid.mrr',  baseline: baseline.hybrid.mrr,     current: current.hybrid.mrr,     drop: 0 },
    { metric: 'hybrid.hit',  baseline: baseline.hybrid.hitRateAtK, current: current.hybrid.hitRateAtK, drop: 0 },
  ];
  for (const d of deltas) d.drop = d.baseline - d.current;

  console.log('\n[check-retrieval] Deltas (negative = regression):');
  let failed = false;
  for (const d of deltas) {
    const status = d.drop > threshold
      ? '\x1b[31mFAIL\x1b[0m'
      : d.drop > 0
        ? '\x1b[33mWARN\x1b[0m'
        : '\x1b[32m OK \x1b[0m';
    console.log(`  ${status}  ${d.metric.padEnd(14)} baseline=${d.baseline.toFixed(3)}  current=${d.current.toFixed(3)}  Δ=${(-d.drop).toFixed(3)}`);
    if (d.drop > threshold) failed = true;
  }

  if (failed) {
    console.error(`\n[check-retrieval] FAIL — regression exceeds threshold (${threshold}).`);
    console.error(`[check-retrieval] If this drop is intentional, update the baseline:`);
    console.error(`  npx tsx scripts/check-retrieval.ts --update-baseline`);
    process.exit(1);
  }

  console.log(`\n[check-retrieval] PASS — all metrics within threshold (${threshold}).`);
}

main().catch((err) => {
  console.error('[check-retrieval] failed:', err);
  process.exit(1);
});
