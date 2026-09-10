/**
 * One-shot bootstrap for the C9 news corpus on Neon:
 *  1. enable the pgvector extension (idempotent),
 *  2. create the search_news(...) hybrid-search SQL function,
 *  3. (tables are created by `drizzle-kit push --config=drizzle.postgres.config.ts`,
 *     sources are seeded automatically by the crawler on first run).
 * Safe to re-run: every statement is idempotent.
 * Run: node --env-file=.env.local scripts/setup-news-corpus.mjs
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  // Neon endpoints require TLS; `channel_binding` in the conn string plus
  // this explicit ssl object conflicts otherwise ("does not support SSL").
  ssl: process.env.NEON_DATABASE_URL.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false },
});

async function main() {
  console.log('[1/4] pgvector extension…');
  await pool.query('create extension if not exists vector');
  console.log('      ok');

  console.log('[2/4] push drizzle schema (drizzle-kit)…');
  // Done by the caller: npx drizzle-kit push --config=drizzle.postgres.config.ts
  console.log('      (caller runs drizzle-kit push separately)');

  console.log('[3/4] search_news function…');
  await pool.query(`
    create or replace function search_news(
      p_query      text,
      p_embedding  vector(1024),
      p_limit      integer default 30,
      p_max_age_days integer default 90,
      p_countries  text[] default null
    ) returns table (
      id bigint, url text, title text, body text, published_at timestamptz,
      domain text, source_name text, tier smallint, is_state_media boolean,
      is_certified boolean, suspended_in text[], score real
    )
    language sql stable
    as $$
      with matches as (
        select a.id, a.url, a.title, a.body, a.published_at,
               s.domain, s.name as source_name, s.tier, s.is_state_media,
               s.is_certified, s.suspended_in,
               ts_rank(
                 to_tsvector('french', coalesce(a.title,'') || ' ' || coalesce(a.body,'')),
                 websearch_to_tsquery('french', p_query)
               ) as lexical,
               case when p_embedding is null or a.embedding is null then 0
                    else 1 - (a.embedding <=> p_embedding) end as semantic
          from news_articles a
          join news_sources s on s.id = a.source_id
         where a.body is not null
           and a.published_at > now() - make_interval(days => p_max_age_days)
           and (p_countries is null or s.country = any(p_countries))
           and (to_tsvector('french', coalesce(a.title,'') || ' ' || coalesce(a.body,''))
                @@ websearch_to_tsquery('french', p_query)
                or p_embedding is not null)
      )
      select id, url, title, body, published_at, domain, source_name, tier,
             is_state_media, is_certified, suspended_in,
             (
               (0.5 * lexical + 0.5 * semantic)
               -- Freshness: 7-day half-life, floored so an older but highly
               -- relevant piece is never eliminated outright.
               * greatest(0.25, exp(-0.099 * extract(epoch from (now() - published_at)) / 86400))
               -- Tier 1 sources (agencies, IFCN/JTI) get a 25% lift; aggregators take a 15% cut.
               * case tier when 1 then 1.25 when 3 then 0.85 else 1.0 end
             )::real as score
        from matches
       order by score desc
       limit p_limit;
    $$;
  `);
  console.log('      ok');

  console.log('[4/4] seed news_sources from registry…');
  // Registry is TypeScript; import via a tiny tsx shim would drag the whole
  // Next alias graph. Instead the registry seeds itself on first crawl run
  // (ensureSourcesSeeded in src/lib/news/crawl.ts). Nothing to do here.
  console.log('      (done by the crawler on first run)');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
    return pool.end();
  });
