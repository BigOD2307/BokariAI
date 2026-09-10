/**
 * Neon Postgres schema — replaces the Supabase project (`urwdrdobbvkenztuhcgx`,
 * dead: DNS no longer resolves, most likely a free-tier auto-pause that ran
 * past the auto-delete window). This is a from-scratch bootstrap, not a live
 * migration — the old project's data is unrecoverable, there is nothing to
 * backfill.
 *
 * Consolidates every `supabase/migrations/*.sql` file into one current-state
 * schema (those files stay in the repo as history, but are no longer applied
 * anywhere). Two structural changes from the Supabase version:
 *  - `auth.users` doesn't exist on plain Postgres, so `users` absorbs it
 *    (email + passwordHash + role) merged with what `profiles` used to hold
 *    (plan, quota). See `src/lib/auth/*` for the hand-rolled bcrypt+jose
 *    service that replaces Supabase Auth/GoTrue.
 *  - No RLS: Postgres RLS depended on `auth.uid()`, which only exists inside
 *    Supabase's PostgREST layer. Every ownership check RLS used to enforce
 *    (`chats_owner_all`, `messages_chat_owner`, `feedback_owner_all`,
 *    `shares` owner/public-read, `share_views` insert/owner-read) is
 *    reimplemented as an explicit `WHERE` in the query code that replaces
 *    `createServerClient()` — see `src/lib/db/postgres/client.ts` and each
 *    route under `src/app/api/`.
 *
 * `flashcard_decks`/`flashcards` (Supabase mode, opt-in, SQLite is the
 * default store) and `youtube_cache` (confirmed dead code, nothing reads or
 * writes it) are deliberately NOT ported — add them back if `BOKARI_LEARN_STORE`
 * is ever actually set to `supabase`.
 */
import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  smallint,
  boolean,
  bigserial,
  bigint,
  timestamp,
  date,
  jsonb,
  vector,
  char,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';

// ----- users (was auth.users + public.profiles) -----------------------------
export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  role: text('role').notNull().default('user'), // 'user' | 'admin' — becomes JWT app_metadata.role
  plan: text('plan').notNull().default('free'),
  emailVerified: boolean('email_verified').notNull().default(true), // no verification flow, matches the old "confirm email OFF" instant-signup behaviour
  quotaUnitsToday: integer('quota_units_today').notNull().default(0),
  quotaDay: date('quota_day')
    .notNull()
    .default(sql`current_date`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

// ----- chats ------------------------------------------------------------------
export const chats = pgTable(
  'chats',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    sources: jsonb('sources')
      .notNull()
      .default(sql`'[]'::jsonb`),
    files: jsonb('files')
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    index('idx_chats_user_id').on(t.userId),
    index('idx_chats_created_at').on(t.createdAt.desc()),
    index('idx_chats_user_updated_at').on(t.userId, t.updatedAt.desc()),
    index('idx_chats_title_fr').using(
      'gin',
      sql`to_tsvector('french', ${t.title})`,
    ),
  ],
);

// ----- messages -----------------------------------------------------------
export const messages = pgTable(
  'messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    messageId: text('message_id').notNull(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    backendId: text('backend_id').notNull().default(''),
    query: text('query').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    responseBlocks: jsonb('response_blocks')
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text('status').notNull().default('answering'),
  },
  (t) => [
    index('idx_messages_chat_id').on(t.chatId),
    index('idx_messages_pair').on(t.chatId, t.messageId),
    index('idx_messages_created_at').on(t.createdAt.desc()),
    check(
      'messages_status_check',
      sql`${t.status} IN ('answering', 'completed', 'error')`,
    ),
  ],
);

// ----- feedback -----------------------------------------------------------
export const feedback = pgTable(
  'feedback',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    messageId: text('message_id').notNull(),
    chatId: text('chat_id'),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    rating: smallint('rating').notNull(),
    comment: text('comment'),
    captured: jsonb('captured')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('idx_feedback_user_id').on(t.userId),
    index('idx_feedback_chat_id').on(t.chatId),
    index('idx_feedback_rating').on(t.rating),
    index('idx_feedback_created_at').on(t.createdAt.desc()),
    check('feedback_rating_check', sql`${t.rating} IN (-1, 0, 1)`),
    // Simplified from the old Supabase partial index (COALESCE'd user_id,
    // WHERE rating <> 0): the route already deletes rating=0 rows instead of
    // upserting them (src/app/api/feedback/route.ts), so every row that
    // reaches an insert/upsert already has rating <> 0 — that condition is
    // always true here and doesn't need enforcing in the index. A plain
    // UNIQUE(message_id, user_id) is equivalent for this app's actual write
    // pattern AND — unlike the COALESCE/partial version — is a real target
    // `ON CONFLICT (message_id, user_id)` can upsert against
    // (Postgres can't target an expression+partial index that way).
    // Standard SQL NULL semantics already give anonymous (user_id IS NULL)
    // rows the "never conflicts" behaviour the COALESCE trick existed for.
    uniqueIndex('idx_feedback_message_user').on(t.messageId, t.userId),
  ],
);

// ----- shares ---------------------------------------------------------------
export const shares = pgTable(
  'shares',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id')
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull().unique(),
    isIndexed: boolean('is_indexed').notNull().default(true),
    anonymousAuthor: boolean('anonymous_author').notNull().default(false),
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_shares_slug').on(t.slug),
    index('idx_shares_chat_id').on(t.chatId),
    index('idx_shares_user_id').on(t.userId),
    index('idx_shares_active')
      .on(t.chatId)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

// ----- share_views ----------------------------------------------------------
export const shareViews = pgTable(
  'share_views',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    shareId: text('share_id')
      .notNull()
      .references(() => shares.id, { onDelete: 'cascade' }),
    referrer: text('referrer'),
    country: text('country'),
    userAgent: text('user_agent'),
    viewedAt: timestamp('viewed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('idx_share_views_share_id').on(t.shareId),
    index('idx_share_views_viewed_at').on(t.viewedAt.desc()),
  ],
);

// ----- guest_quota ------------------------------------------------------------
export const guestQuota = pgTable(
  'guest_quota',
  {
    fingerprint: text('fingerprint').primaryKey(),
    quotaUnitsToday: integer('quota_units_today').notNull().default(0),
    quotaDay: date('quota_day')
      .notNull()
      .default(sql`current_date`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [index('guest_quota_day_idx').on(t.quotaDay)],
);

// ----- discover_articles (folds in metadata + content-extraction + embeddings) ----
export const discoverArticles = pgTable(
  'discover_articles',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    topic: text('topic').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    url: text('url').notNull(),
    thumbnail: text('thumbnail'),
    domain: text('domain'),
    batchId: text('batch_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    language: text('language').default('fr'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    author: text('author'),
    qualityScore: real('quality_score').default(0),
    fullContent: text('full_content'),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    contentHash: text('content_hash'),
    // JSONB array of floats, not pgvector — see 20260604_embeddings.sql for
    // the reasoning (brute-force cosine over a small candidate set).
    embedding: jsonb('embedding'),
    embeddingModel: text('embedding_model'),
  },
  (t) => [
    uniqueIndex('idx_discover_articles_url').on(t.url),
    index('idx_discover_articles_topic').on(t.topic),
    index('idx_discover_articles_batch').on(t.batchId),
    index('idx_discover_articles_created').on(t.createdAt.desc()),
    index('idx_discover_articles_published_at').on(t.publishedAt.desc()),
    index('idx_discover_articles_language')
      .on(t.language)
      .where(sql`${t.language} IS NOT NULL`),
    index('idx_discover_articles_extracted_at').on(t.extractedAt.desc()),
    index('discover_articles_embedded_idx')
      .on(t.embeddingModel)
      .where(sql`${t.embedding} IS NOT NULL`),
  ],
);

// ----- news_sources (C9 — editorial register of ingested outlets) -----------
/**
 * The editorial backbone of the African news corpus. Unlike discover_articles
 * (search-engine-fed, 7-day retention), this register feeds a direct RSS
 * crawler that reads each outlet's own feed — real publication dates, full
 * text, and an explicit editorial label.
 *
 * `tier` drives ranking: 1 = news agency or IFCN/JTI-certified outlet,
 * 2 = established private press, 3 = aggregator that republishes wire copy
 * verbatim (dedup by content_hash matters most for these).
 *
 * `isStateMedia` and `suspendedIn` drive what we TELL the reader, never what
 * we hide: a Malian user clicking an RFI link gets nothing (RFI has been
 * banned in Mali since 2022), so we label rather than drop the source.
 */
export const newsSources = pgTable(
  'news_sources',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    domain: text('domain').notNull().unique(),
    name: text('name').notNull(),
    country: char('country', { length: 2 }),
    language: char('language', { length: 2 }).notNull().default('fr'),
    feedUrl: text('feed_url'),
    tier: smallint('tier').notNull().default(2),
    isStateMedia: boolean('is_state_media').notNull().default(false),
    isCertified: boolean('is_certified').notNull().default(false), // IFCN or JTI
    suspendedIn: text('suspended_in')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`), // ISO codes where the outlet is blocked
    enabled: boolean('enabled').notNull().default(true),
    lastFetchAt: timestamp('last_fetch_at', { withTimezone: true }),
    lastFetchStatus: text('last_fetch_status'),
    consecutiveFailures: smallint('consecutive_failures').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    check('news_sources_tier_check', sql`${t.tier} BETWEEN 1 AND 3`),
    index('idx_news_sources_enabled').on(t.enabled),
  ],
);

// ----- news_articles (C9 — the corpus itself) -------------------------------
/**
 * One row per ingested article. The body is nullable because the retention
 * window (90 days) drops the text but keeps the metadata row: the fact that
 * an article existed, was published on that date, by that outlet, is kept
 * even after the body is gone.
 *
 * `embedding` is a true pgvector column (HNSW index, cosine ops) — unlike
 * discover_articles' JSONB embeddings, similarity search never ships 500
 * vectors over the wire; it runs inside Postgres.
 *
 * `contentHash` (sha256 of the body prefix) catches two things: silent edits
 * of an already-ingested URL, and cross-site copy-paste — aggregators like
 * Maliweb/Malijet republish wire copy verbatim; same hash = same article,
 * only the first (usually primary) source is kept.
 */
export const newsArticles = pgTable(
  'news_articles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sourceId: bigint('source_id', { mode: 'number' })
      .notNull()
      .references(() => newsSources.id, { onDelete: 'cascade' }),
    canonicalUrl: text('canonical_url').notNull().unique(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    summary: text('summary'),
    author: text('author'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    language: char('language', { length: 2 }).notNull().default('fr'),
    embedding: vector('embedding', { dimensions: 1024 }), // BGE-M3 — matches BOKARI_EMBEDDING_DIMENSIONS
    contentHash: text('content_hash'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index('idx_news_articles_published').on(t.publishedAt.desc()),
    index('idx_news_articles_source_published').on(
      t.sourceId,
      t.publishedAt.desc(),
    ),
    index('idx_news_articles_hash')
      .on(t.contentHash)
      .where(sql`${t.contentHash} IS NOT NULL`),
    // HNSW over cosine distance: sublinear ANN search, built once, cheap to query.
    index('idx_news_articles_embedding').using(
      'hnsw',
      sql`${t.embedding} vector_cosine_ops`,
    ),
    // Full-text search in French, for the lexical half of hybrid retrieval.
    index('idx_news_articles_fts').using(
      'gin',
      sql`to_tsvector('french', coalesce(${t.title}, '') || ' ' || coalesce(${t.body}, ''))`,
    ),
  ],
);
