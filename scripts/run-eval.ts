/**
 * Live eval runner.  Compares BM25 vs hybrid (BM25 + BGE-M3 cosine)
 * on the 34-query African eval set, against the fixture corpus.
 *
 * Usage:
 *   npx tsx scripts/run-eval.ts
 *   npx tsx scripts/run-eval.ts --out=docs/eval/2026-06-02.md
 *   npx tsx scripts/run-eval.ts --offline
 *   npx tsx scripts/run-eval.ts --precomputed       # use in-repo BGE-M3 vectors, no API call
 *   npx tsx scripts/run-eval.ts --cosine-weight=0.5 # override the ranker cosine weight
 *   npx tsx scripts/run-eval.ts --rerank            # add the cross-encoder rerank column
 *   npx tsx scripts/run-eval.ts --rerank --rerank-mode=live
 *                                                 # real OpenRouter /rerank call (needs OPENROUTER_API_KEY)
 *
 * Exits 0 on success.  Prints a markdown report to stdout (and
 * optionally to a file).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { FIXTURE_CORPUS_EMBEDDED } from '../src/lib/eval/fixture-embedded';
import { runEval, DEFAULT_QUERIES } from '../src/lib/eval/runner';
import { embed } from '../src/lib/ai/gateway';

function parseArgs() {
  const out: {
    outFile: string | null;
    offline: boolean;
    precomputed: boolean;
    cosineWeight: number | null;
    rerank: boolean;
    rerankMode: 'live' | 'offline';
    rerankTopN: number;
  } = {
    outFile: null,
    offline: false,
    precomputed: false,
    cosineWeight: null,
    rerank: false,
    rerankMode: 'offline',
    rerankTopN: 10,
  };
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]!;
    if (arg.startsWith('--out=')) out.outFile = arg.slice('--out='.length);
    if (arg === '--offline') out.offline = true;
    if (arg === '--precomputed') out.precomputed = true;
    if (arg === '--rerank') out.rerank = true;
    if (arg.startsWith('--rerank-mode=')) {
      const v = arg.slice('--rerank-mode='.length);
      if (v === 'live' || v === 'offline') out.rerankMode = v;
      else {
        console.error(`[eval] --rerank-mode must be 'live' or 'offline', got "${v}"`);
        process.exit(2);
      }
    }
    if (arg.startsWith('--rerank-top-n=')) {
      out.rerankTopN = Number(arg.slice('--rerank-top-n='.length));
    }
    if (arg.startsWith('--cosine-weight=')) {
      out.cosineWeight = Number(arg.slice('--cosine-weight='.length));
    }
  }
  return out;
}

function formatReport(report: Awaited<ReturnType<typeof runEval>>, queries: typeof DEFAULT_QUERIES): string {
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 10);
  lines.push(`# Bokari Citation Engine — Eval Report (${now})`);
  lines.push('');
  lines.push(`**Queries:** ${report.queries}  `);
  lines.push(`**Corpus:** ${FIXTURE_CORPUS_EMBEDDED.length} articles (fixture with BGE-M3 embeddings)  `);
  lines.push(`**K:** ${report.k}  `);
  lines.push(`**Cosine weight:** ${report.cosineWeight.toFixed(2)}  `);
  lines.push(`**Embedding model:** baai/bge-m3 via OpenRouter  `);
  if (report.rerankConfig) {
    lines.push(`**Rerank:** ${report.rerankConfig.mode} (topN=${report.rerankConfig.topN}, candidatePool=${report.rerankConfig.candidatePool})  `);
  }
  lines.push('');
  lines.push('## Aggregate metrics');
  lines.push('');
  const header = report.reranked
    ? '| Metric | BM25 only | Hybrid (BM25 + cosine) | Reranked (top-50 → rerank → top-K) | ΔHybrid | ΔRerank |'
    : '| Metric | BM25 only | Hybrid (BM25 + cosine) | Δ |';
  const sep = report.reranked
    ? '| --- | --- | --- | --- | --- | --- |'
    : '| --- | --- | --- | --- |';
  lines.push(header);
  lines.push(sep);
  const fmt = (x: number) => x.toFixed(3);
  const delta = (a: number, b: number) => {
    const d = b - a;
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(3)}`;
  };
  if (report.reranked) {
    lines.push(
      `| NDCG@${report.k} | ${fmt(report.bm25Only.ndcgAtK)} | ${fmt(report.hybrid.ndcgAtK)} | ${fmt(report.reranked.ndcgAtK)} | ${delta(report.bm25Only.ndcgAtK, report.hybrid.ndcgAtK)} | ${delta(report.bm25Only.ndcgAtK, report.reranked.ndcgAtK)} |`,
    );
    lines.push(
      `| MRR | ${fmt(report.bm25Only.mrr)} | ${fmt(report.hybrid.mrr)} | ${fmt(report.reranked.mrr)} | ${delta(report.bm25Only.mrr, report.hybrid.mrr)} | ${delta(report.bm25Only.mrr, report.reranked.mrr)} |`,
    );
    lines.push(
      `| Hit rate@${report.k} | ${fmt(report.bm25Only.hitRateAtK)} | ${fmt(report.hybrid.hitRateAtK)} | ${fmt(report.reranked.hitRateAtK)} | ${delta(report.bm25Only.hitRateAtK, report.hybrid.hitRateAtK)} | ${delta(report.bm25Only.hitRateAtK, report.reranked.hitRateAtK)} |`,
    );
  } else {
    lines.push(`| NDCG@${report.k} | ${fmt(report.bm25Only.ndcgAtK)} | ${fmt(report.hybrid.ndcgAtK)} | ${delta(report.bm25Only.ndcgAtK, report.hybrid.ndcgAtK)} |`);
    lines.push(`| MRR | ${fmt(report.bm25Only.mrr)} | ${fmt(report.hybrid.mrr)} | ${delta(report.bm25Only.mrr, report.hybrid.mrr)} |`);
    lines.push(`| Hit rate@${report.k} | ${fmt(report.bm25Only.hitRateAtK)} | ${fmt(report.hybrid.hitRateAtK)} | ${delta(report.bm25Only.hitRateAtK, report.hybrid.hitRateAtK)} |`);
  }
  lines.push('');
  lines.push('## Per-query NDCG@K');
  lines.push('');
  if (report.reranked) {
    lines.push('| Query | BM25 | Hybrid | Reranked | ΔRerank | Topic |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
  } else {
    lines.push('| Query | BM25 | Hybrid | Δ | Topic |');
    lines.push('| --- | --- | --- | --- | --- |');
  }
  for (let i = 0; i < report.perQuery.length; i++) {
    const pq = report.perQuery[i];
    const q = queries[i];
    const bm = pq.bm25.ndcg;
    const hy = pq.hybrid.ndcg;
    if (report.reranked && pq.reranked) {
      const rr = pq.reranked.ndcg;
      const d = rr - bm;
      const sign = d >= 0 ? '+' : '';
      lines.push(
        `| ${pq.query} | ${fmt(bm)} | ${fmt(hy)} | ${fmt(rr)} | ${sign}${d.toFixed(3)} | ${q.topic} |`,
      );
    } else {
      const d = hy - bm;
      const sign = d >= 0 ? '+' : '';
      lines.push(
        `| ${pq.query} | ${fmt(bm)} | ${fmt(hy)} | ${sign}${d.toFixed(3)} | ${q.topic} |`,
      );
    }
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- **Relevance grades** are derived, not human-rated:');
  lines.push('  - 3 = ≥50% of query tokens in title, or mustMatch in title');
  lines.push('  - 2 = ≥30% of query tokens in title');
  lines.push('  - 1 = any query token or mustMatch in body only');
  lines.push('  - 0 = topic gate fails, or no overlap');
  lines.push('- **Topic gate** is strict — articles in a different topic score 0 unless');
  lines.push('  a mustMatch term is in the title.');
  lines.push('- **Fixture** is 53 hand-written articles covering the 34 queries.  Real');
  lines.push('  corpora (1000+ articles) will produce different absolute numbers but the');
  lines.push('  relative BM25-vs-hybrid comparison should hold.');
  if (report.rerankConfig) {
    lines.push(`- **Rerank** uses ${report.rerankConfig.mode} mode.  In offline mode, the`);
    lines.push('  "cross-encoder" is a deterministic token-overlap scorer used for');
    lines.push('  ranking-reorder regression tests.  The lift reported is the');
    lines.push('  *theoretical ceiling* on this fixture, not the live production lift.');
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * "Precomputed" mode: load BGE-M3 query vectors from a sibling
 * .precomputed.json file (generated by `npm run eval:precompute`).
 * Falls back to a unit-vector embedder if the file is missing —
 * which makes it equivalent to --offline.
 */
function loadPrecomputedQueryEmbeddings(): Map<string, number[]> | null {
  const path = resolve('docs/eval/query-embeddings.json');
  if (!require('node:fs').existsSync(path)) return null;
  const raw = require('node:fs').readFileSync(path, 'utf-8');
  return new Map(Object.entries(JSON.parse(raw) as Record<string, number[]>));
}

async function main() {
  const args = parseArgs();
  let embedFn: (texts: string[]) => Promise<number[][]>;
  let cosineWeight = args.cosineWeight ?? 0.3;

  if (args.precomputed) {
    const cached = loadPrecomputedQueryEmbeddings();
    if (!cached) {
      console.error('[eval] --precomputed requires docs/eval/query-embeddings.json.');
      console.error('[eval] Run `npm run eval:precompute` to generate it.');
      process.exit(2);
    }
    console.log('[eval] PRECOMPUTED mode — using cached BGE-M3 query vectors from docs/eval/query-embeddings.json');
    embedFn = async (texts: string[]) =>
      texts.map((t) => cached.get(t) ?? (() => { throw new Error(`No precomputed embedding for "${t}"`); })());
  } else if (args.offline) {
    console.log('[eval] OFFLINE mode — using unit vectors (not real embeddings)');
    embedFn = async (texts: string[]) =>
      texts.map((_t, i) => {
        const v = new Array(8).fill(0);
        v[i % 8] = 1;
        return v;
      });
  } else {
    console.log('[eval] Embedding queries via BGE-M3 (OpenRouter)…');
    embedFn = embed;
  }

  if (args.rerank) {
    if (args.rerankMode === 'live' && !process.env.OPENROUTER_API_KEY) {
      console.error('[eval] --rerank --rerank-mode=live requires OPENROUTER_API_KEY.');
      process.exit(2);
    }
    console.log(`[eval] RERANK enabled (mode=${args.rerankMode}, topN=${args.rerankTopN})`);
  }

  const report = await runEval(FIXTURE_CORPUS_EMBEDDED, DEFAULT_QUERIES, embedFn, {
    cosineWeight,
    ...(args.rerank
      ? { rerank: { topN: args.rerankTopN, mode: args.rerankMode } }
      : {}),
  });
  const md = formatReport(report, DEFAULT_QUERIES);

  console.log('\n' + md);

  if (args.outFile) {
    const outPath = resolve(args.outFile);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, md, 'utf-8');
    console.log(`\n[eval] Wrote report to ${outPath}`);
  }
}

main().catch((err) => {
  console.error('[eval] failed:', err);
  process.exit(1);
});
