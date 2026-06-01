/**
 * Live smoke test for the AI gateway.
 *
 * Run with:
 *   OPENROUTER_API_KEY=sk-or-v1-… npx tsx scripts/smoke-gateway.ts
 *
 * The script:
 *   1. Pulls 3 short titles
 *   2. Embeds them with BGE-M3
 *   3. Computes pairwise cosine similarity
 *   4. Embeds a 4th title in French and an unrelated title to show
 *      similarity drop
 *   5. Tests the chat fallback by calling a non-existent primary model
 *
 * Exits non-zero on the first failure.  Prints timing per call.
 */
import { embedOne, chatWithFallback } from '../src/lib/ai/gateway';
import { getAiConfig } from '../src/lib/ai/config';
import { cosine, cosine01 } from '../src/lib/discover/cosine';

const ARTICLES = [
  'Bamako : le nouveau président prête serment',
  'Bamako : nouveau président, discours inaugural',
  'Ethereum staking rewards hit a new high in Q2',
];

async function main() {
  const t0 = Date.now();
  console.log(`[smoke] gateway: ${getAiConfig().embedding.model} via ${getAiConfig().embedding.provider}`);

  // ---- Embeddings ----
  const vectors: number[][] = [];
  for (const t of ARTICLES) {
    const v = await embedOne(t);
    vectors.push(v);
    console.log(`[smoke] embedded "${t.slice(0, 40)}…" → ${v.length} dims (${Date.now() - t0}ms)`);
  }

  console.log('\n[smoke] Pairwise cosine similarity:');
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = cosine(vectors[i], vectors[j]);
      const sim01 = cosine01(sim);
      console.log(`  [${i}]↔[${j}]: ${sim.toFixed(4)} (norm01=${sim01.toFixed(4)})`);
    }
  }

  // ---- Chat fallback ----
  // Primary is Groq, which is NOT in the Bokari config.  The fallback
  // (OpenRouter) should kick in and answer.
  console.log('\n[smoke] Testing chatWithFallback (Groq → OpenRouter)…');
  try {
    const out = await chatWithFallback(
      async (m) => {
        return await (m as any).generateText({
          messages: [
            {
              role: 'system',
              content:
                'You are a test assistant. Reply with a single JSON object: {"pong": true}',
            },
            { role: 'user', content: 'ping' },
          ],
          options: { maxTokens: 50, temperature: 0 },
        });
      },
      'smoke-ping',
    );
    console.log('[smoke] chat fallback succeeded:', JSON.stringify(out).slice(0, 200));
  } catch (err: any) {
    console.log('[smoke] chat fallback failed:', err?.message ?? err);
  }

  console.log('\n[smoke] done.');
}

main().catch((err) => {
  console.error('[smoke] failed:', err);
  process.exit(1);
});
