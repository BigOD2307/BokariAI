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
 *   npx tsx scripts/check-retrieval.ts                    # full live eval (needs OPENROUTER_API_KEY)
 *   npx tsx scripts/check-retrieval.ts --offline          # unit vectors, BM25-only gate
 *   npx tsx scripts/check-retrieval.ts --precomputed      # cached BGE-M3 vectors, full hybrid gate
 *   npx tsx scripts/check-retrieval.ts --threshold=0.05
 *   npx tsx scripts/check-retrieval.ts --update-baseline
 *   npx tsx scripts/check-retrieval.ts --rerank           # include cross-encoder rerank in the gate
 *
 * The baseline lives at `docs/eval/baseline.json` and is updated
 * manually (or via `--update-baseline`) when the eval is intentionally
 * improved.  Threshold defaults to 0.02 (NDCG@10 / MRR / hit-rate).
 *
 * `--precomputed` is the default in CI (see
 * .github/workflows/retrieval-regression.yml).  It uses the
 * BGE-M3 vectors in `docs/eval/query-embeddings.json` so the gate
 * catches hybrid regressions, not just BM25 regressions.
 *
 * `--rerank` is opt-in: it adds the `reranked` column to the gate.
 * Use it locally to validate a rerank change; CI stays on hybrid-only
 * until the rerank signal has been in production for a week.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FIXTURE_CORPUS_EMBEDDED } from '../src/lib/eval/fixture-embedded';
import { AFRICAN_EVAL_QUERIES } from '../src/lib/eval/dataset';
import { runEval, type EmbedFn } from '../src/lib/eval/runner';
import { embed } from '../src/lib/ai/gateway';

const args = process.argv.slice(2);
function arg(flag: string, fallback: string | null = null): string | null {
  const a = args.find((a) => a.startsWith(flag));
  if (!a) return fallback;
  if (a.includes('=')) return a.split('=').slice(1).join('=');
  return args[args.indexOf(a) + 1] ?? fallback;
}

const offline = args.includes('--offline');
const precomputed = args.includes('--precomputed');
const updateBaseline = args.includes('--update-baseline');
const rerank = args.includes('--rerank');
const rerankMode: 'live' | 'offline' = arg('--rerank-mode', 'offline') === 'live' ? 'live' : 'offline';
const threshold = Number(arg('--threshold', '0.02'));
const cosineWeight = Number(arg('--cosine-weight', '0.3'));
const baselinePath = resolve('docs/eval/baseline.json');

type Baseline = {
  bm25Only: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  hybrid: { ndcgAtK: number; mrr: number; hitRateAtK: number };
  reranked: { ndcgAtK: number; mrr: number; hitRateAtK: number } | null;
  queries: number;
  corpusSize: number;
  k: number;
  cosineWeight: number;
  rerankConfig: { topN: number; candidatePool: number; mode: 'live' | 'offline' } | null;
  model: string;
  recordedAt: string;
};

function unitVector(dim: number): number[] {
  // Deterministic unit vector for offline mode.
  const v = new Array<number>(dim).fill(0);
  v[0] = 1;
  return v;
}

function loadPrecomputed(): EmbedFn {
  const path = resolve('docs/eval/query-embeddings.json');
  if (!existsSync(path)) {
    throw new Error(
      `[check-retrieval] --precomputed requires docs/eval/query-embeddings.json. ` +
        `Run \`npm run eval:precompute\` first.`,
    );
  }
  const cached = new Map(
    Object.entries(JSON.parse(readFileSync(path, 'utf-8')) as Record<string, number[]>),
  );
  return async (texts: string[]) =>
    texts.map((t) => {
      const v = cached.get(t);
      if (!v) throw new Error(`No precomputed embedding for "${t}"`);
      return v;
    });
}

async function main() {
  let embedFn: EmbedFn;
  let mode: 'live' | 'precomputed' | 'offline';
  if (precomputed) {
    embedFn = loadPrecomputed();
    mode = 'precomputed';
  } else if (offline) {
    embedFn = async (inputs: string[]) => inputs.map(() => unitVector(1024));
    mode = 'offline';
  } else {
    embedFn = embed;
    mode = 'live';
  }

  console.log(`[check-retrieval] Mode: ${mode}  Cosine weight: ${cosineWeight.toFixed(2)}  Rerank: ${rerank}`);
  console.log('[check-retrieval] Running eval…');
  const t0 = Date.now();
  const report = await runEval(
    FIXTURE_CORPUS_EMBEDDED,
    AFRICAN_EVAL_QUERIES,
    embedFn,
    {
      cosineWeight,
      ...(rerank
        ? { rerank: { topN: 10, mode: rerankMode } }
        : {}),
    },
  );
  console.log(`[check-retrieval] Done in ${Date.now() - t0}ms.`);

  const current: Baseline = {
    bm25Only: report.bm25Only,
    hybrid: report.hybrid,
    reranked: report.reranked,
    queries: report.queries,
    corpusSize: FIXTURE_CORPUS_EMBEDDED.length,
    k: report.k,
    cosineWeight,
    rerankConfig: report.rerankConfig,
    model:
      mode === 'precomputed'
        ? 'baai/bge-m3 (precomputed)'
        : mode === 'offline'
          ? 'unit-vector'
          : 'baai/bge-m3',
    recordedAt: new Date().toISOString(),
  };

  console.log('\n[check-retrieval] Current metrics:');
  console.log(`  BM25-only  NDCG@${current.k}: ${current.bm25Only.ndcgAtK.toFixed(3)}  MRR: ${current.bm25Only.mrr.toFixed(3)}  Hit: ${current.bm25Only.hitRateAtK.toFixed(3)}`);
  console.log(`  Hybrid     NDCG@${current.k}: ${current.hybrid.ndcgAtK.toFixed(3)}  MRR: ${current.hybrid.mrr.toFixed(3)}  Hit: ${current.hybrid.hitRateAtK.toFixed(3)}`);
  if (current.reranked) {
    console.log(`  Reranked   NDCG@${current.k}: ${current.reranked.ndcgAtK.toFixed(3)}  MRR: ${current.reranked.mrr.toFixed(3)}  Hit: ${current.reranked.hitRateAtK.toFixed(3)}`);
  }

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
  console.log(`\n[check-retrieval] Baseline (${baseline.recordedAt}, w=${baseline.cosineWeight.toFixed(2)}):`);
  console.log(`  BM25-only  NDCG@${baseline.k}: ${baseline.bm25Only.ndcgAtK.toFixed(3)}  MRR: ${baseline.bm25Only.mrr.toFixed(3)}  Hit: ${baseline.bm25Only.hitRateAtK.toFixed(3)}`);
  console.log(`  Hybrid     NDCG@${baseline.k}: ${baseline.hybrid.ndcgAtK.toFixed(3)}  MRR: ${baseline.hybrid.mrr.toFixed(3)}  Hit: ${baseline.hybrid.hitRateAtK.toFixed(3)}`);
  if (baseline.reranked) {
    console.log(`  Reranked   NDCG@${baseline.k}: ${baseline.reranked.ndcgAtK.toFixed(3)}  MRR: ${baseline.reranked.mrr.toFixed(3)}  Hit: ${baseline.reranked.hitRateAtK.toFixed(3)}`);
  }

  // Per-metric deltas.  Hybrid is the primary metric; reranked is
  // checked only when both `rerank` is enabled AND the baseline has
  // a `reranked` block.  BM25-only is informational.
  const deltas: Array<{ metric: string; baseline: number; current: number; drop: number }> = [
    { metric: 'hybrid.ndcg', baseline: baseline.hybrid.ndcgAtK, current: current.hybrid.ndcgAtK, drop: 0 },
    { metric: 'hybrid.mrr',  baseline: baseline.hybrid.mrr,     current: current.hybrid.mrr,     drop: 0 },
    { metric: 'hybrid.hit',  baseline: baseline.hybrid.hitRateAtK, current: current.hybrid.hitRateAtK, drop: 0 },
  ];
  if (rerank && baseline.reranked && current.reranked) {
    deltas.push(
      { metric: 'reranked.ndcg', baseline: baseline.reranked.ndcgAtK, current: current.reranked.ndcgAtK, drop: 0 },
      { metric: 'reranked.mrr',  baseline: baseline.reranked.mrr,     current: current.reranked.mrr,     drop: 0 },
      { metric: 'reranked.hit',  baseline: baseline.reranked.hitRateAtK, current: current.reranked.hitRateAtK, drop: 0 },
    );
  }
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
