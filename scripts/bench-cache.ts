/**
 * @file bench-cache.ts
 * @description Micro-bench for the Sprint 3 semantic cache.
 *
 * Run with:
 *   npx tsx scripts/bench-cache.ts
 *   npx tsx scripts/bench-cache.ts --json
 *
 * What it measures:
 *   1. Insert throughput (writes/sec at typical cache size)
 *   2. Exact-hash lookup latency (p50 / p95)
 *   3. Cosine-similarity scan latency (p50 / p95)
 *   4. Cache-hit ratio on a synthetic workload
 *      (30% exact replays, 30% near-duplicates, 40% cold)
 *
 * Output goes to stdout in a human-readable table.  Use
 * `--json` to print a machine-readable summary for CI.
 *
 * Why a script and not a Vitest test?  Benchmarks should not
 * be in the test loop — they're slow and noisy on shared CI
 * runners.  This file is invoked manually or from a release
 * pipeline.
 *
 * @author Amadou — Dicken AI
 * @version 1.0.0
 */
import {
  SemanticCache,
} from '../src/lib/cache/store';
import {
  cacheResponse,
  tryGetCachedResponse,
  getCacheStats,
} from '../src/lib/cache/semantic';
import path from 'path';
import os from 'os';
import fs from 'fs';

const N = parseInt(process.env.BENCH_N || '2000', 10);
const NEAR_DUP_RATE = 0.3;
const EXACT_DUP_RATE = 0.3;

function tmpDb(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bokari-bench-'));
  return path.join(dir, 'cache.sqlite');
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function randomQuery(rand: () => number, topicIx: number): string {
  const adjectives = ['best', 'cheap', 'top', 'fast', 'reliable'];
  const topics = [
    'crm software',
    'solar inverter',
    'mali news',
    'payment gateway africa',
    'tax filing',
    'weather forecast',
    'stock price apple',
  ];
  const suffixes = ['for startups', 'in 2026', 'review', 'tutorial', ''];
  const adj = adjectives[Math.floor(rand() * adjectives.length)]!;
  const topic = topics[topicIx % topics.length]!;
  const suf = suffixes[Math.floor(rand() * suffixes.length)]!;
  return [adj, topic, suf].filter(Boolean).join(' ');
}

function makeVector(seed: number, dim: number = 64): number[] {
  const rand = rng(seed);
  return Array.from({ length: dim }, () => rand() * 2 - 1);
}

function perturb(vec: number[], strength: number, rand: () => number): number[] {
  return vec.map((x) => x + (rand() - 0.5) * strength);
}

function percentiles(samples: number[], ps: number[]): Record<string, number> {
  const sorted = samples.slice().sort((a, b) => a - b);
  const out: Record<string, number> = {};
  for (const p of ps) {
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    out[`p${Math.round(p * 100)}`] = sorted[idx] ?? 0;
  }
  return out;
}

async function main(): Promise<void> {
  const dbPath = tmpDb();
  const cache = new SemanticCache(dbPath);
  const rand = rng(42);
  const json = process.argv.includes('--json');

  const queries: string[] = [];
  const vectors: number[][] = [];
  for (let i = 0; i < N; i++) {
    queries.push(randomQuery(rand, i));
    vectors.push(makeVector(i + 1));
  }

  // Insert phase
  const insertStart = Date.now();
  for (let i = 0; i < N; i++) {
    await cacheResponse(queries[i]!, vectors[i]!, `response-${i}`, { store: cache });
  }
  const insertMs = Date.now() - insertStart;

  // Exact-hash lookup
  const exactLatencies: number[] = [];
  for (let i = 0; i < N; i++) {
    const t0 = process.hrtime.bigint();
    await tryGetCachedResponse(queries[i]!, async () => vectors[i]!, { store: cache });
    exactLatencies.push(Number(process.hrtime.bigint() - t0) / 1_000_000);
  }

  // Cosine-similarity scan (perturb each vector slightly)
  const cosineLatencies: number[] = [];
  for (let i = 0; i < N; i++) {
    const perturbed = perturb(vectors[i]!, 0.05, rand);
    const t0 = process.hrtime.bigint();
    await tryGetCachedResponse(`variant-${i}`, async () => perturbed, {
      store: cache,
      threshold: 0.9,
    });
    cosineLatencies.push(Number(process.hrtime.bigint() - t0) / 1_000_000);
  }

  // Mixed workload
  let exactHits = 0;
  let semanticHits = 0;
  let misses = 0;
  for (let i = 0; i < N; i++) {
    const r = rand();
    let q: string;
    if (r < EXACT_DUP_RATE) {
      q = queries[i]!;
    } else if (r < EXACT_DUP_RATE + NEAR_DUP_RATE) {
      q = `variant-${i}`;
    } else {
      q = `unique-${i}-${Math.random()}`;
    }
    const result = await tryGetCachedResponse(q, async () => vectors[i]!, { store: cache });
    if (result?.hitType === 'exact') exactHits++;
    else if (result?.hitType === 'semantic') semanticHits++;
    else misses++;
  }

  const finalStats = getCacheStats({ store: cache });
  cache.close();

  const summary = {
    N,
    insertThroughputPerSec: (N / insertMs) * 1000,
    exactLookup: percentiles(exactLatencies, [0.5, 0.95]),
    cosineLookup: percentiles(cosineLatencies, [0.5, 0.95]),
    workload: {
      exactHits,
      semanticHits,
      misses,
      hitRate: (exactHits + semanticHits) / N,
    },
    cacheSize: finalStats.size,
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('Semantic cache micro-bench (N=' + N + ')');
    console.log('─────────────────────────────────────────');
    console.log('Insert throughput : ' + summary.insertThroughputPerSec.toFixed(0) + ' rows/sec');
    console.log('Exact-hash lookup : p50=' + summary.exactLookup.p50.toFixed(3) + 'ms  p95=' + summary.exactLookup.p95.toFixed(3) + 'ms');
    console.log('Cosine scan       : p50=' + summary.cosineLookup.p50.toFixed(3) + 'ms  p95=' + summary.cosineLookup.p95.toFixed(3) + 'ms');
    console.log(
      'Workload          : ' +
        summary.workload.exactHits +
        ' exact + ' +
        summary.workload.semanticHits +
        ' semantic / ' +
        summary.workload.misses +
        ' miss  (hitRate=' +
        (summary.workload.hitRate * 100).toFixed(1) +
        '%)',
    );
    console.log('Final cache size  : ' + summary.cacheSize + ' rows');
  }

  try {
    fs.rmSync(path.dirname(dbPath), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error('Bench failed:', err);
  process.exit(1);
});
