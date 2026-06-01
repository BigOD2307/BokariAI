// Live probe of Groq + OpenRouter embeddings APIs (2026-06-01)
// Just to know what's actually available before committing to a stack.
// Keys are read from env vars — never commit them to source.

const GROQ_KEY = process.env.GROQ_API_KEY ?? '';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? '';

async function probeGroq() {
  console.log('=== GROQ ===');
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${GROQ_KEY}` },
    });
    const data = await r.json();
    const all = (data.data || []).map((m: any) => m.id);
    console.log('All models:', all.length);
    console.log('Embedding-capable:', all.filter((m: string) => m.includes('embed')));

    // Try the standard "nomic-embed" probe to confirm/refute
    if (all.length > 0) {
      const probeModels = ['nomic-embed-text-v1.5', 'text-embedding-3-small', 'nomic-embed-text'];
      for (const m of probeModels) {
        const er = await fetch('https://api.groq.com/openai/v1/embeddings', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GROQ_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ model: m, input: 'test' }),
        });
        console.log(`  embed [${m}]: ${er.status} ${er.statusText}`);
        if (er.status === 200) {
          const d = await er.json();
          console.log(`    → ${d.data?.[0]?.embedding?.length} dims`);
        }
      }
    }
  } catch (err) {
    console.error('Groq probe failed:', err);
  }
}

async function probeOpenRouter() {
  console.log('\n=== OPENROUTER ===');
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
    });
    const data = await r.json();
    const all = data.data || [];
    console.log('All models:', all.length);

    // OpenRouter exposes the model list with a free-form `id` and
    // optional architecture info.  Embedding-capable ones typically
    // have `architecture.modality` set to include "embeddings" — but
    // not always.  We pull the embedding ones by ID pattern.
    const embedModels = all
      .filter((m: any) => /embed|bge|e5|qwen.*embed|nomic|gte|cohere|mistral-embed/i.test(m.id))
      .map((m: any) => m.id)
      .sort();
    console.log('Embedding-capable candidates:', embedModels);

    // Probe a few of the most promising
    const probeModels = [
      'baai/bge-m3',
      'qwen/qwen3-embedding-8b',
      'intfloat/multilingual-e5-large',
      'intfloat/e5-large-v2',
      'baai/bge-base-en-v1.5',
      'baai/bge-large-en-v1.5',
      'openai/text-embedding-3-small',
      'mistralai/mistral-embed',
    ];
    for (const m of probeModels) {
      const er = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: m, input: 'test' }),
      });
      if (er.status === 200) {
        const d = await er.json();
        const dims = d.data?.[0]?.embedding?.length;
        const pricing = all.find((x: any) => x.id === m)?.pricing;
        console.log(`  embed [${m}]: ${er.status} ${dims ? `→ ${dims} dims` : '?'}  pricing=${JSON.stringify(pricing)}`);
      } else {
        console.log(`  embed [${m}]: ${er.status} ${er.statusText}`);
      }
    }
  } catch (err) {
    console.error('OpenRouter probe failed:', err);
  }
}

async function main() {
  if (!GROQ_KEY || !OPENROUTER_KEY) {
    console.error('Set GROQ_API_KEY and OPENROUTER_API_KEY env vars.');
    process.exit(1);
  }
  await probeGroq();
  await probeOpenRouter();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
