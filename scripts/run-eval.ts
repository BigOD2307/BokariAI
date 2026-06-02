/**
 * Live eval runner.  Compares BM25 vs hybrid (BM25 + BGE-M3 cosine)
 * on the 20-query African eval set, against the fixture corpus.
 *
 * Usage:
 *   npx tsx scripts/run-eval.ts
 *   npx tsx scripts/run-eval.ts --out=docs/eval/2026-06-02.md
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
  const out: { outFile: string | null; offline: boolean } = { outFile: null, offline: false };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--out=')) out.outFile = arg.slice('--out='.length);
    if (arg === '--offline') out.offline = true;
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
  lines.push(`**Embedding model:** baai/bge-m3 via OpenRouter  `);
  lines.push('');
  lines.push('## Aggregate metrics');
  lines.push('');
  lines.push('| Metric | BM25 only | Hybrid (BM25 + cosine) | Δ |');
  lines.push('| --- | --- | --- | --- |');
  const fmt = (x: number) => x.toFixed(3);
  const delta = (a: number, b: number) => {
    const d = b - a;
    const sign = d >= 0 ? '+' : '';
    return `${sign}${d.toFixed(3)}`;
  };
  lines.push(`| NDCG@${report.k} | ${fmt(report.bm25Only.ndcgAtK)} | ${fmt(report.hybrid.ndcgAtK)} | ${delta(report.bm25Only.ndcgAtK, report.hybrid.ndcgAtK)} |`);
  lines.push(`| MRR | ${fmt(report.bm25Only.mrr)} | ${fmt(report.hybrid.mrr)} | ${delta(report.bm25Only.mrr, report.hybrid.mrr)} |`);
  lines.push(`| Hit rate@${report.k} | ${fmt(report.bm25Only.hitRateAtK)} | ${fmt(report.hybrid.hitRateAtK)} | ${delta(report.bm25Only.hitRateAtK, report.hybrid.hitRateAtK)} |`);
  lines.push('');
  lines.push('## Per-query NDCG@K');
  lines.push('');
  lines.push('| Query | BM25 | Hybrid | Δ | Topic |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (let i = 0; i < report.perQuery.length; i++) {
    const pq = report.perQuery[i];
    const q = queries[i];
    const bm = pq.bm25.ndcg;
    const hy = pq.hybrid.ndcg;
    const d = hy - bm;
    const sign = d >= 0 ? '+' : '';
    lines.push(
      `| ${pq.query} | ${fmt(bm)} | ${fmt(hy)} | ${sign}${d.toFixed(3)} | ${q.topic} |`,
    );
  }
  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- **Relevance grades** are derived, not human-rated:');
  lines.push('  - 3 = query term in title');
  lines.push('  - 1 = query term in body');
  lines.push('  - 0 = no match');
  lines.push('- **Topic gate** is strict — articles in a different topic score 0 unless');
  lines.push('  a mustMatch term is in the title.');
  lines.push('- **Fixture** is 30 hand-written articles covering the 20 queries.  Real');
  lines.push('  corpora (1000+ articles) will produce different absolute numbers but the');
  lines.push('  relative BM25-vs-hybrid comparison should hold.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs();

  // If offline, use a fake embedder (random unit vectors) and a clear note.
  const embedFn = args.offline
    ? async (texts: string[]) =>
        texts.map((_t, i) => {
          const v = new Array(8).fill(0);
          v[i % 8] = 1;
          return v;
        })
    : embed;

  if (!args.offline) {
    console.log('[eval] Embedding queries via BGE-M3 (OpenRouter)…');
  } else {
    console.log('[eval] OFFLINE mode — using unit vectors (not real embeddings)');
  }

  const report = await runEval(FIXTURE_CORPUS_EMBEDDED, DEFAULT_QUERIES, embedFn);
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
