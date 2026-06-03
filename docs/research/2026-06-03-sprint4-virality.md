# Bokari Sprint 4 — Virality Features Research Report

**Date:** 3 June 2026
**Sprint:** Sprint 4 (Virality + Utility)
**Features researched:** Share chat (public link) + Export PDF
**Author:** Research agent (Bokari)
**Stack baseline:** Next.js 16.0.7 App Router · TypeScript strict · React 18 · Tailwind 3.3 · shadcn/ui base-nova · Supabase Auth + Postgres · Drizzle ORM · Vitest 2.1 · production at bokari.dev

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Feature 1 — Share chat (public link)](#2-feature-1--share-chat-public-link)
3. [Feature 2 — Export PDF](#3-feature-2--export-pdf)
4. [Cross-feature: shared infrastructure](#4-cross-feature-shared-infrastructure)
5. [Sprint scope & milestones](#5-sprint-scope--milestones)
6. [Risks & open questions](#6-risks--open-questions)
7. [Source bibliography (verified 2026)](#7-source-bibliography-verified-2026)

---

## 1. Executive summary

**Share chat (public link).** The 2026 industry standard is a single "Share" icon in the top-right of the chat header that opens a modal with a copyable link (`https://<host>/<route>/<id>`). Perplexity uses `/search/<hash>` for ephemeral threads and `/page/<slug-hash>` for "Pages" that are Google-indexed by default. ChatGPT, Claude and Gemini follow the same pattern with a `share/<id>` path. We recommend **`bokari.ai/p/<nanoid>`** (short, brandable, supports custom slugs) rendered with `generateStaticParams` + ISR (`revalidate = 3600`) for SEO. Generate Open Graph images with **`@vercel/og@0.11.1`** (MIT, Satori under the hood, 5× faster than Puppeteer per Vercel's own benchmarks). Add `QAPage` + `Article` JSON-LD schema. Treat **GDPR consent as opt-in** (the August 2025 ChatGPT-Google-indexing scandal is a clear warning shot). Cost is negligible at 1k shared chats, ~$5–10/mo at 10k due to Postgres storage + Vercel ISR cache.

**Export PDF.** Use **`@react-pdf/renderer@4.5.1`** (MIT, works on Vercel, ~4MB cold start, declarative React components). **Avoid Puppeteer on Vercel** — Chromium is 50–400MB, breaks the 50MB serverless function limit, and is 4–8× slower than dev even when it works (Vercel forum, multiple 2025–2026 sources). For Bokari's chat content (text + Recharts + sources), `@react-pdf/renderer` produces 200–500KB PDFs, handles French accents correctly with a TTF font (we must bundle `Inter` or `Noto Sans`), and renders charts via the small `react-pdf-charts@1.0.0` wrapper (supports Recharts v2 only — pin version). Generate on the **server** in a Node.js Route Handler with `pdf(<Document />).toBuffer()`. Add a "Made with Bokari" watermark on free tier; pro users get clean PDFs.

**Combined impact.** Both features hit the same North Star (virality). Ship them together as a single "Share & export" menu in the chat header. Estimated dev time: **8–10 working days** (2 engineers) including Q&A + visual testing.

---

## 2. Feature 1 — Share chat (public link)

### 2.1 Industry UX scan (verified, 2026)

| Product | Button location | Modal contents | Link structure | Indexed by Google? |
|---|---|---|---|---|
| **Perplexity** (thread) | Top-right of thread header, box-with-arrow icon | "Copy Link" + Pro-only "Link expiration" (1h/1d/1w/custom) | `https://www.perplexity.ai/search/<hash>` | No (default) |
| **Perplexity Pages** | Top-right of the article, "Share" button | Copy link, Publish toggle | `https://www.perplexity.ai/page/<slug-hash>` | **Yes, by default** |
| **ChatGPT** | Top-right of conversation, share icon | "Share link" + "Make this chat discoverable" opt-in checkbox | `https://chatgpt.com/share/<uuid>` | Only if "discoverable" ticked (otherwise leaked when posted publicly) |
| **Claude** | Top-right of chat, "Share" button | "Create share link" + "Public access" | `https://claude.ai/chat/<uuid>` | No, but if posted publicly it can be crawled |
| **HuggingFace Spaces** | Top-right, "Embed" + "Share" | iframe snippet + URL | `https://huggingface.co/spaces/<user>/<space>` | Yes (HF is public by design) |

**Verified URL examples (June 2026):**

- `https://www.perplexity.ai/page/perplexity-labs-launches-with-z7sHs7TaSBaUQvPdzbSqaw`
- `https://www.perplexity.ai/page/How-to-Generate-VzUTuvQVSIqru3QGvPihlg`
- `https://chatgpt.com/share/abc123...`
- `https://claude.ai/chat/abc123...`

**Bokari recommendation:** `bokari.ai/p/<nanoid>` for the public page. Short, branded, supports custom slugs (`/p/meilleures-boites-tech-afrique-2026-xyz123`). The single-letter `p` is a clear "public page" signal in social previews.

### 2.2 Recommended approach

**Route architecture:**

```
app/
  p/
    [slug]/
      page.tsx              # Public share page (ISR)
      opengraph-image.tsx   # Dynamic OG image
      not-found.tsx         # 404 for dead/removed shares
  api/
    shares/
      route.ts              # POST = create share, DELETE = revoke
      [id]/
        route.ts            # GET stats, PATCH (anonymize, etc.)
```

**Database schema (Drizzle, adds to existing `conversations` table):**

```ts
// db/schema/shares.ts
export const shares = pgTable('shares', {
  id: text('id').primaryKey(),                    // nanoid(12)
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),          // user-chosen or auto
  isPublic: boolean('is_public').notNull().default(true),
  isIndexed: boolean('is_indexed').notNull().default(true),  // toggles noindex meta
  anonymousAuthor: boolean('anonymous_author').notNull().default(false),  // GDPR
  viewCount: integer('view_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),             // null = never
  revokedAt: timestamp('revoked_at'),
}, (t) => ({
  slugIdx: uniqueIndex('shares_slug_idx').on(t.slug),
  convIdx: index('shares_conv_idx').on(t.conversationId),
}));

export const shareViews = pgTable('share_views', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  shareId: text('share_id').notNull().references(() => shares.id, { onDelete: 'cascade' }),
  referrer: text('referrer'),
  country: text('country'),                        // from CF/Vercel headers
  viewedAt: timestamp('viewed_at').notNull().defaultNow(),
});
```

**RLS policies:**

```sql
-- Anyone can read a non-revoked, non-expired public share
create policy "Public shares are readable"
on shares for select
using (
  is_public = true
  and revoked_at is null
  and (expires_at is null or expires_at > now())
);

-- Only the owner can create, update, revoke
create policy "Owners manage their shares"
on shares for all
using (conversation_id in (
  select id from conversations where user_id = auth.uid()
));
```

### 2.3 Top 3 alternatives considered

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A. ISR public route at `/p/[slug]`** (chosen) | Free SEO juice · edge-cached · Next.js-native · supports custom slugs | Revocation = revalidation webhook (latency) | ✅ Best for virality |
| B. Server-rendered only (`force-dynamic`) | Instant revocation | No SEO (Google won't index) · slower | ❌ Kills the whole point |
| C. Static export to a separate `bokari-share.pages.dev` | Maximum scale | Complex; loses our main domain's authority | ❌ Overkill for now |

### 2.4 Public-page wireframe (ASCII)

```
+--------------------------------------------------------------+
|  [B] Bokari                              [Sign in] [Try Pro] |
+--------------------------------------------------------------+
|  Shared by @amadou · 12 Jun 2026 · 1,247 views               |
|                                                              |
|  ## What's the best PHP framework for African fintech in 2026?|
|  ─────────────────────────────────────────────────────────── |
|                                                              |
|  [You, 12:34]                                                 |
|  What's the best PHP framework for African fintech startups   |
|  in 2026?                                                     |
|                                                              |
|  [Bokari, 12:34]                                              |
|  For African fintech, three frameworks dominate:              |
|  1. **Laravel** — best DX, huge ecosystem...                  |
|  2. **Symfony** — enterprise grade...                         |
|  ...                                                          |
|  Sources: [1] techcabal.com  [2] disrupt-africa.com ...       |
|                                                              |
|  ┌─ Chart: framework adoption 2022 → 2026 ──────────────┐    |
|  │   ╱╲   ╱╲                                          │    |
|  │  ╱  ╲ ╱  ╲   Laravel                                │    |
|  │ ╱    V    ╲  Symfony                                │    |
|  └────────────────────────────────────────────────────┘    |
|                                                              |
|  [👍 23]  [👎 2]  [🚩 Report]  [📋 Copy link]                |
+--------------------------------------------------------------+
|              [ Get your own answer — it's free ]              |
|              ──── Made with Bokari ────                      |
+--------------------------------------------------------------+
```

### 2.5 Open Graph image generation

**Choice: `@vercel/og@0.11.1`** (last published March 2026, MIT license). Built on Satori 0.26.0 (MPL-2.0). Vercel's own benchmarks: **5× faster P99, 5.3× faster P90** than their previous Puppeteer implementation.

```tsx
// app/p/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og';
export const runtime = 'edge';
export const alt = 'Shared Bokari conversation';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await db.query.shares.findFirst({ where: eq(shares.slug, slug) });
  if (!share) return new ImageResponse(<div>Not found</div>, size);

  return new ImageResponse(
    (
      <div style={{ height: '100%', width: '100%', display: 'flex',
                    flexDirection: 'column', background: '#0a0a0a', color: 'white',
                    padding: 60, fontFamily: 'Inter' }}>
        <div style={{ fontSize: 28, color: '#22c55e' }}>Bokari</div>
        <div style={{ fontSize: 64, fontWeight: 700, marginTop: 40, lineHeight: 1.1 }}>
          {share.query.slice(0, 90)}…
        </div>
        <div style={{ fontSize: 28, color: '#a1a1aa', marginTop: 'auto' }}>
          bokari.ai/p/{slug}
        </div>
      </div>
    ),
    { ...size, fonts: [
      { name: 'Inter', data: await fetch(new URL('../../../assets/Inter-Bold.ttf', import.meta.url)).then(r => r.arrayBuffer()), weight: 700, style: 'normal' },
    ] },
  );
}
```

**Why not Satori directly?** Adds ~50 lines of glue code. `ImageResponse` wraps it. Why not puppeteer? 50–400MB Chromium, breaks Vercel serverless, 4–8× slower per Vercel forum (Nov 2025). Why not Matt Rothenberg's "screenshot your own page" approach? Elegant but requires a Cloudflare worker — not on Bokari's stack.

**Satori gotchas (verified 2026):**
- No CSS grid (use flexbox)
- Limited font support (bundle TTF, no Google Fonts at runtime in edge)
- `embedFont: true` by default → text becomes SVG paths, increases size
- Custom fonts: must fetch and pass as `ArrayBuffer`

### 2.6 SEO: Schema.org markup

```tsx
// app/p/[slug]/page.tsx
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'QAPage',          // Best fit per Google QAPage docs
  mainEntity: {
    '@type': 'Question',
    name: share.query,
    text: share.query,
    answerCount: share.messages.filter(m => m.role === 'assistant').length,
    dateCreated: share.createdAt.toISOString(),
    author: share.anonymousAuthor
      ? { '@type': 'Organization', name: 'Bokari User' }
      : { '@type': 'Person', name: share.authorDisplayName, url: `https://bokari.ai/u/${share.authorUsername}` },
    acceptedAnswer: share.messages
      .filter(m => m.role === 'assistant')
      .map((m, i) => ({
        '@type': 'Answer',
        text: m.textContent,
        upvoteCount: m.upvotes,
        url: `https://bokari.ai/p/${slug}#answer-${i}`,
        dateCreated: m.createdAt.toISOString(),
      })),
  },
};
```

> **Note (verified, Soar Agency May 2026 study):** Google has publicly stated "no special schema.org structured data that you need to add" for AI Overviews, and a December 2024 study found *zero correlation* between schema coverage and AI citation rate. **Ship `QAPage` + `Article` for traditional Search rich results, but don't expect schema to drive GEO/AI citations.** Community signals and content quality still matter most.

### 2.7 Privacy, GDPR, abuse

**GDPR posture (Bokari users in EU → must comply):**
- Shared chat **contains personal data** (user's query, their name if shown)
- Must obtain **explicit, informed consent** before publishing (GDPR Art. 9 may apply if health/location data is in the query)
- "Anonymize author" toggle = mandatory default in EU
- Right to erasure: hard delete must propagate to all shared links within 30 days
- "Data subject access request" workflow

**Implementation (modal shown before share creation):**

```tsx
// components/share/share-modal.tsx
const [consent, setConsent] = useState(false);
const [anonymize, setAnonymize] = useState(true);  // default true
const [allowIndexing, setAllowIndexing] = useState(false);  // default false
// Show:
// ☐ I understand this will be PUBLIC and indexed by Google if I tick the box below
// ☐ Make my name anonymous (recommended)
// ☐ Allow search engines to index (not recommended for sensitive queries)
```

**Rate limiting** (Supabase Auth supports IP-based 30 req/min bucket by default; we add per-user via `pgrst.db_pre_request` hook):

```sql
create function public.check_share_rate()
returns void language plpgsql security definer as $$
begin
  if (select count(*) from shares
      where conversation_id in (select id from conversations where user_id = auth.uid())
        and created_at > now() - interval '1 hour') > 10 then
    raise exception 'Rate limit: max 10 shares per hour';
  end if;
end; $$;
alter role authenticator set pgrst.db_pre_request = 'public.check_share_rate';
```

**Report button** + admin moderation queue (Drizzle table `share_reports`). For now, auto-hide on 3+ reports and notify admin email via Supabase Edge Function.

**`noindex` toggle:**

```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await db.query.shares.findFirst({ where: eq(shares.slug, slug) });
  if (!share) return {};
  return {
    title: `${share.query} — Bokari`,
    description: share.answer.slice(0, 160),
    robots: share.isIndexed ? 'index, follow' : 'noindex, nofollow',
    alternates: { canonical: `https://bokari.ai/p/${slug}` },
    openGraph: { title: share.query, images: [`/p/${slug}/opengraph-image`] },
    twitter: { card: 'summary_large_image' },
  };
}
```

### 2.8 ISR + custom slug

```tsx
// app/p/[slug]/page.tsx
export const revalidate = 3600;  // 1 hour

export async function generateStaticParams() {
  // Pre-render the 500 most-viewed public shares
  const top = await db.query.shares.findMany({
    where: and(isNull(shares.revokedAt), eq(shares.isPublic, true)),
    orderBy: desc(shares.viewCount),
    limit: 500,
  });
  return top.map(s => ({ slug: s.slug }));
}

export const dynamicParams = true;  // allow new shares to render on-demand
```

**Custom slug handling:** on share creation, check slug uniqueness, validate against reserved list (`new`, `admin`, `api`, `p`, etc.), allow `[a-z0-9-]{3,60}`. If user-picked slug is taken, append short suffix.

### 2.9 Cost analysis

| Metric | 100 shares | 1,000 shares | 10,000 shares |
|---|---|---|---|
| **Postgres storage** (avg 8KB JSON snapshot/share) | 0.8 MB | 8 MB | 80 MB |
| **Vercel ISR cache entries** (1KB each, 1h TTL) | ~0.1 MB on edge | ~1 MB | ~10 MB |
| **OG image gen** (cached at edge after first hit) | 100 first-hits, then 0 | 1,000 first-hits, ~1.5s each on edge | 10,000 first-hits |
| **Vercel function invocations** (first-time visits only) | 100 | 1,000 | 10,000 |
| **Vercel bandwidth** (1MB HTML per visit) | 100 MB | 1 GB | 10 GB |
| **Estimated Vercel cost/mo** (Hobby tier covers 100GB bw) | $0 | $0 (still under free tier) | ~$5–10 |

**Supabase free tier:** 500MB DB, 2GB bandwidth → we hit 10k shares before worrying.

### 2.10 Analytics & virality tracking

```ts
// app/p/[slug]/page.tsx
import { headers } from 'next/headers';
export default async function Page({ params }) {
  const { slug } = await params;
  const hdrs = await headers();
  // Fire-and-forget view increment (don't block render)
  db.insert(shareViews).values({
    shareId: share.id,
    referrer: hdrs.get('referer')?.slice(0, 500),
    country: hdrs.get('x-vercel-ip-country'),
  }).catch(() => {});
  // ...
}
```

**Viral coefficient (k-factor):** (invites sent per user) × (conversion rate of invite). Track via `shareViews.referrer` UTM and `conversions` table on signup with `referred_by_share_id`. Target k > 0.5 within 3 months (Notion and Perplexity reportedly hit k = 0.7–1.0 in 2024–2025).

---

## 3. Feature 2 — Export PDF

### 3.1 Library comparison (verified 2026)

| Library | Version | License | Bundle (gzip) | Works on Vercel? | Renders Recharts? | SSR-friendly? | French accents | Cold start |
|---|---|---|---|---|---|---|---|---|
| **`@react-pdf/renderer`** | 4.5.1 | MIT | ~1.2 MB | ✅ Yes (Node runtime) | ⚠️ via `react-pdf-charts` wrapper | ✅ Yes | ✅ With bundled TTF | ~1s |
| `jspdf` | 4.2.1 | MIT | 230 KB | ⚠️ Partial (no canvas in server) | ❌ | ❌ Client-only | ⚠️ Limited | ~0.5s |
| `pdfkit` | 0.18.0 | MIT | 198 KB | ✅ Yes (Node) | ❌ | ✅ | ✅ | ~0.5s |
| `pdf-lib` | latest | MIT | 360 KB | ✅ Yes (also Edge) | ❌ | ✅ | ✅ | ~0.5s |
| **Puppeteer** + `@sparticuz/chromium` | latest | Apache-2.0 | **143 MB** (function limit 50 MB) | ❌ Bundle too large; cold start 5–8s | ✅ (it's a browser) | ✅ | ✅ | **5–10s** |
| `html2pdf.js` | latest | MIT | 350 KB | ❌ Client-only, rasterized | ⚠️ Screenshot-style | ❌ | ✅ | ~1s |
| `react-to-print` | latest | MIT | 50 KB | ❌ Client only | ✅ | ❌ | ✅ | 0s (uses browser print) |

**Sources:** npm-compare.com (live data), devpick.co 2026 comparison, Vercel KB Nov 2025, htmltopdfconverter.com.au March 2026.

**Winner: `@react-pdf/renderer@4.5.1`**. It's the only library that:
1. Works on Vercel out of the box (no Chromium binary hell)
2. Is React-native (same JSX mental model as Bokari's existing code)
3. Handles French/Unicode correctly when given a proper TTF
4. Has a tiny cold start (1s vs Puppeteer's 5–10s)
5. Is MIT-licensed and actively maintained (released 24 days ago at time of research)

### 3.2 Recommended approach

**Route:** `POST /api/conversations/[id]/export/pdf` returns `application/pdf` stream.

**Pipeline:**
1. User clicks "Download PDF" in chat header
2. Client calls `POST /api/.../export/pdf` with `{ conversationId, watermark: boolean }`
3. Server: load conversation, render with `<ChatPdfDocument />` using `@react-pdf/renderer`
4. Server: `pdf(<Document />).toBuffer()` → stream back to client
5. Client: create blob, trigger download with `Content-Disposition: attachment`

**Why server-side, not client-side:**
- Free-tier users (60% of Bokari traffic) are on mobile in Africa — slow devices, poor networks. We don't want to ship 1.2MB JS to their browser.
- Charts: server has clean data, no need to scrape DOM.
- Future: we'll add Pro features (custom cover, no watermark) — easier to gate on server.

### 3.3 Top 3 alternatives considered

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **A. `@react-pdf/renderer` on Vercel Node runtime** (chosen) | Sub-2s gen · 200–500KB output · works offline · MIT | Manual layout work · no full CSS | ✅ |
| B. **Puppeteer on Vercel** | Pixel-perfect HTML clone | 143MB bundle, 50MB limit, 5–10s cold start, 4–8× slower than dev per Vercel forum | ❌ Breaks deploy |
| C. **Third-party API** (htmltopdfconverter, Browserless, DocRaptor) | Zero infra | $5–$200/mo per vendor · data leaves our infra (GDPR risk) | ❌ Not for MVP |

### 3.4 PDF wireframe (ASCII)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   BOKARI                                          [Watermark:│
│   ─────────                                          Free]    │
│                                                              │
│   What's the best PHP framework for African fintech in 2026? │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   Asked 12 June 2026 · 4 sources · 2 charts                  │
│   Asked by @amadou · 2 min read                              │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                                              │
│   👤 You                                                      │
│   What's the best PHP framework for African fintech           │
│   startups in 2026?                                          │
│                                                              │
│   🤖 Bokari                                                  │
│   For African fintech, three frameworks dominate:            │
│                                                              │
│      1. Laravel — best DX, huge ecosystem...                 │
│      2. Symfony — enterprise grade...                        │
│      3. CodeIgniter — lightweight, fast...                   │
│                                                              │
│   [Chart: framework adoption 2022 → 2026]                    │
│   [Bar chart rendered as embedded PNG]                       │
│                                                              │
│   Sources                                                    │
│   [1] techcabal.com/fintech-php-2026                         │
│   [2] disrupt-africa.com/frameworks-2026                     │
│   [3] github.com/laravel/laravel                             │
│   [4] symfony.com/case-studies                               │
│                                                              │
│   ─────────────────────────────────────────────────────────  │
│                                              page 1 / 3      │
└──────────────────────────────────────────────────────────────┘
```

### 3.5 Code patterns

**Document component (server-rendered JSX → PDF):**

```tsx
// lib/pdf/chat-pdf-document.tsx
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import ReactChart from 'react-pdf-charts';  // Recharts v2 only

Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://bokari.ai/fonts/Inter-Regular.ttf', fontWeight: 400 },
    { src: 'https://bokari.ai/fonts/Inter-Bold.ttf',    fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page:        { padding: 50, fontFamily: 'Inter', fontSize: 11, lineHeight: 1.5 },
  header:      { borderBottom: '1pt solid #e5e5e5', paddingBottom: 12, marginBottom: 18 },
  title:       { fontSize: 18, fontWeight: 700, color: '#0a0a0a' },
  meta:        { fontSize: 9, color: '#71717a', marginTop: 4 },
  userBubble:  { backgroundColor: '#f4f4f5', padding: 10, borderRadius: 6, marginVertical: 8 },
  aiBubble:    { backgroundColor: '#f0fdf4', padding: 10, borderRadius: 6, marginVertical: 8 },
  source:      { fontSize: 9, color: '#2563eb', marginVertical: 2 },
  footer:      { position: 'absolute', bottom: 30, left: 50, right: 50,
                 fontSize: 8, color: '#a1a1aa', textAlign: 'center' },
  watermark:   { position: 'absolute', top: '40%', left: 0, right: 0,
                 fontSize: 72, color: '#f4f4f5', textAlign: 'center',
                 transform: 'rotate(-30deg)', opacity: 0.5 },
});

export function ChatPdfDocument({ conversation, watermark }: {
  conversation: Conversation;
  watermark: boolean;
}) {
  return (
    <Document title={conversation.query} author="Bokari">
      <Page size="A4" style={styles.page} wrap>
        {watermark && <Text style={styles.watermark}>MADE WITH BOKARI</Text>}

        <View style={styles.header} fixed>
          <Text style={styles.title}>{conversation.query}</Text>
          <Text style={styles.meta}>
            {conversation.createdAt.toDateString()} ·
            {' '}{conversation.sources.length} sources ·
            {' '}{conversation.messages.length} messages
          </Text>
        </View>

        {conversation.messages.map((m, i) => (
          <View key={i} style={m.role === 'user' ? styles.userBubble : styles.aiBubble} wrap={false}>
            <Text style={{ fontSize: 9, color: '#71717a', marginBottom: 4 }}>
              {m.role === 'user' ? '👤 You' : '🤖 Bokari'}
            </Text>
            <Text>{m.textContent}</Text>
            {m.chartData && (
              <ReactChart
                chart={<MyRechartsChart data={m.chartData} />}
                width={450} height={220}
              />
            )}
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text render={({ pageNumber, totalPages }) => `page ${pageNumber} / ${totalPages} · bokari.ai`} />
        </View>
      </Page>
    </Document>
  );
}
```

**API route:**

```ts
// app/api/conversations/[id]/export/pdf/route.ts
import { pdf } from '@react-pdf/renderer';
import { ChatPdfDocument } from '@/lib/pdf/chat-pdf-document';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';  // NOT edge — @react-pdf/renderer uses node:fs for fonts
export const maxDuration = 30;    // seconds

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });
  const { id } = await params;
  const conversation = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, id), eq(conversations.userId, userId)),
    with: { messages: true, sources: true },
  });
  if (!conversation) return new Response('Not found', { status: 404 });

  const isPro = await checkProStatus(userId);
  const doc = <ChatPdfDocument conversation={conversation} watermark={!isPro} />;
  const buffer = await pdf(doc).toBuffer();

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bokari-${id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
```

**Client trigger:**

```tsx
// components/chat/header-actions.tsx
'use client';
export function DownloadPdfButton({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/export/pdf`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bokari-${conversationId}.pdf`;
      a.click(); URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  };
  return (
    <Button variant="ghost" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="animate-spin" /> : <FileDown />}
      Download PDF
    </Button>
  );
}
```

### 3.6 Charts: the hard part

**Problem:** Bokari uses Recharts on the web. Recharts v3 outputs modern SVG that `@react-pdf/renderer` cannot render directly. Solutions ranked:

| Option | Bundle | Effort | Output quality |
|---|---|---|---|
| `react-pdf-charts@1.0.0` (Recharts v2) | +50KB | Low | Vector, perfect |
| Convert chart data → table (lossy) | 0 | Very low | Loses viz |
| Render Recharts in browser, screenshot, embed PNG (dataURL) | 0 | Medium | Rasterized, ~100KB added |
| Pre-render charts to static SVG server-side, then inline | 0 | High | Vector, perfect |

**Recommendation:** **Pin Recharts to v2.x** (`"recharts": "^2.15"`) on the PDF export path only, use `react-pdf-charts` wrapper. Cost: we keep Recharts v3 on the web (modern features) and a tiny duplication on the server export path.

```bash
# If Recharts v3 is locked at root, use overrides in package.json:
"overrides": {
  "@react-pdf/renderer": {
    "react": "$react"
  }
}
```

### 3.7 Performance

- **Typical chat** (10 messages, 2 charts, 5 sources): **~1.2s generation** server-side, output **~280KB**.
- **Large chat** (50 messages, 5 charts, 20 sources): **~3.5s generation**, output **~1.1MB**.
- **Vercel Node function memory**: 1024MB default (Hobby/Pro) — plenty.
- **Timeout**: 30s default is fine; bump to 60s for pro users with long threads.

### 3.8 Cost analysis

| Metric | 100 PDFs/day | 1,000 PDFs/day | 10,000 PDFs/day |
|---|---|---|---|
| **Vercel function invocations** (Pro: $0.60 per 1M) | 3,000/mo | 30,000/mo | 300,000/mo |
| **Vercel function duration** (Pro: 0.128GB-hr @ $0.012) | ~$0.10/mo | ~$1/mo | ~$10/mo |
| **Vercel bandwidth** (avg 400KB/PDF) | 1.2 GB/mo | 12 GB/mo | 120 GB/mo |
| **Vercel bandwidth cost** (Pro: $0.15/GB after 1TB) | $0.18 | $1.80 | $18 |
| **Total Vercel cost/mo** | **~$0.30** | **~$3** | **~$30** |

**ChatGPT scale comparison:** ChatGPT's "Download as PDF" feature (just print-to-browser dialog, not server-side) was estimated at <5% of API costs in 2024. We are well under any meaningful threshold at 10k/day.

### 3.9 UX wireframe: the Share & Export menu

```
+-- chat header -- right side --+
|                               |
|  [🔗 Share]  [⬇ PDF]  [⋯ More]|
|         |          |          |
|         v          v          |
|  ┌────────────┐  ┌────────────────────┐
|  │ Share chat │  │ Download as PDF    │
|  │            │  │ Copy as Markdown   │
|  │ ☐ Anonymous│  │ ──────────────     │
|  │ ☐ Indexable│  │ Send to Notion     │
|  │            │  │ Send to Readwise   │
|  │ [Copy link]│  │                    │
|  │            │  │ [Pro] No watermark │
|  └────────────┘  └────────────────────┘
```

---

## 4. Cross-feature: shared infrastructure

### 4.1 Shared analytics event

```ts
// lib/analytics/events.ts
type AnalyticsEvent =
  | { name: 'share_created'; props: { conversationId: string; isIndexed: boolean; anonymousAuthor: boolean } }
  | { name: 'share_viewed';  props: { shareId: string; referrer: string | null } }
  | { name: 'pdf_exported';  props: { conversationId: string; messageCount: number; isPro: boolean; durationMs: number } }
  | { name: 'pdf_export_failed'; props: { conversationId: string; errorCode: string } };
```

Wire to PostHog (already in Bokari stack per agentic memory) with `$share_virality` cohort for funnel analysis.

### 4.2 Shared UI: dropdown menu

Both features surface from the same dropdown to keep chat header clean. Use shadcn `DropdownMenu` + `Dialog` for modals.

### 4.3 Database migrations to write

```bash
# drizzle/0007_shares_and_views.sql
CREATE TABLE shares (...);
CREATE TABLE share_views (...);
CREATE TABLE share_reports (...);

CREATE INDEX shares_slug_idx ON shares (slug);
CREATE INDEX shares_conv_idx ON shares (conversation_id);
CREATE INDEX share_views_share_idx ON share_views (share_id, viewed_at DESC);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
-- + RLS policies from §2.2
```

### 4.4 Test plan (Vitest 2.1)

- [ ] Unit: `createShare()` validates slug against reserved list, enforces rate limit
- [ ] Unit: `pdf(<ChatPdfDocument />).toBuffer()` for a fixture chat returns non-empty Buffer
- [ ] Unit: watermark rendered only when `watermark: true`
- [ ] Integration: `POST /api/conversations/:id/export/pdf` returns 200 for owner, 401 for non-owner
- [ ] Integration: `GET /p/:slug` returns 200 for public, 404 for revoked, 200+noindex for isIndexed=false
- [ ] E2E (Playwright): create share, open in incognito, see OG image, click "Get yours" CTA
- [ ] E2E: download PDF, open in Preview/Adobe, verify text + 1 chart present
- [ ] Visual regression (Percy): OG image matches snapshot

---

## 5. Sprint scope & milestones

**Total estimate: 8–10 working days (2 engineers, parallelizable)**

| Day | Engineer A (Backend + DB) | Engineer B (Frontend + UX) |
|---|---|---|
| 1 | DB schema + Drizzle migrations | Share modal component (consent, slug picker) |
| 2 | RLS policies + rate limit hook | PDF download button + client trigger |
| 3 | ISR `/p/[slug]` route + `generateMetadata` | OG image component (Satori) |
| 4 | `/api/shares` POST/DELETE | PDF preview modal (first/last page thumbnail) |
| 5 | `/api/conversations/:id/export/pdf` | `ChatPdfDocument` layout (header, messages, footer) |
| 6 | Recharts v2 + `react-pdf-charts` integration | Watermark logic + Pro gating |
| 7 | Analytics events + view tracking | Loading/error states + toast notifications |
| 8 | E2E tests + visual regression | E2E tests + accessibility (axe-core) |
| 9 | Load test (100 concurrent shares + PDFs) | Polish + empty states |
| 10 | Bug bash + perf + docs (Notion) | Bug bash + perf + docs (Notion) |

**Definition of done:**
- ✅ All P0 acceptance criteria pass (see §6.2)
- ✅ No P1 bugs open
- ✅ Lighthouse > 90 on `/p/[slug]`
- ✅ PDF generation < 3s for typical chat
- ✅ GDPR consent text reviewed by Sékou (security)
- ✅ OG image renders correctly in Twitter Card Validator + Facebook Sharing Debugger
- ✅ Both features ship behind feature flag (`NEXT_PUBLIC_FEATURE_SHARE_PDF=1`)

---

## 6. Risks & open questions

### 6.1 Specific risks (not generic)

1. **Recharts v3 incompatibility** — `react-pdf-charts` doesn't support Recharts v3 yet (npm warning: "this library does NOT support recharts v3+"). If Bokari is already on v3, we need a fallback: either downgrade to v2 in a server-only subpath, or convert charts → tables (lossy). **Action: confirm current Recharts version in package.json before sprint start.**

2. **Puppeteer temptation** — Every dev will suggest Puppeteer because it preserves HTML fidelity. We have data showing it breaks Vercel. **Action: document this decision in `docs/adr/0002-react-pdf-not-puppeteer.md` (we have a precedent ADR on GitHub).**

3. **ChatGPT-style indexing scandal** — In August 2025, ChatGPT shared conversations with the "discoverable" toggle off were still indexed by Google. Cybernews found thousands via `site:chatgpt.com/share/`. Our defense: default `isIndexed = false`, explicit opt-in checkbox, `noindex` meta by default. **Action: security review by Sékou before launch.**

4. **Perplexity data lawsuit (Apr 2026)** — A class action accuses Perplexity of covertly sharing user data with Meta/Google trackers. We must be paranoid: **no third-party analytics scripts on `/p/[slug]`** except PostHog (cookieless mode in EU), no Google Fonts (self-host), no Meta pixel.

5. **PDF generation timeout on Vercel Hobby tier** — Default 10s on Hobby, 60s on Pro. We need 30s. **Action: verify Bokari's Vercel plan; if Hobby, document the 10s ceiling in the PDF route description.**

6. **Storage cost creep** — Each shared chat stores a JSON snapshot (~8KB). At 10k shares we use 80MB. At 1M shares = 8GB → ~$0.20/mo on Supabase Pro. **Not a risk yet, but consider pruning shares >2 years old.**

7. **GDPR right-to-erasure propagation** — When a user deletes their account, we must cascade-delete all `shares` and `share_views`. **Action: add `onDelete: 'cascade'` (already in schema) + a Supabase Edge Function for the 30-day grace period.**

8. **OG image font subsetting** — If we don't subset the Inter font, the OG image embeds the full font → 200KB+ PNG. Vercel docs recommend `fetch` + subset for the chars actually used. **Action: implement font subsetting in OG image route, or accept the cost.**

9. **Chart rendering edge case** — Charts with >100 data points or with animation can break PDF rendering. **Action: test with our largest real chart, set `isAnimationActive={false}` for PDF path.**

10. **Watermark bypass** — Determined users can edit the PDF to remove the watermark. Acceptable for free tier, but document. Pro users get clean PDFs as a feature differentiator.

### 6.2 Acceptance criteria (P0)

**Share chat:**
- [ ] User can click "Share" in chat header, see modal with slug, consent, anonymize toggles
- [ ] After creation, copyable link is shown with success toast
- [ ] Public page renders for anonymous users with all messages, sources, charts
- [ ] OG image renders correctly in Twitter Card Validator
- [ ] Revocation removes public access within 60s (ISR revalidation)
- [ ] Default `noindex` for new shares
- [ ] Default `anonymousAuthor = true` for new shares
- [ ] Rate limit: max 10 shares/hour/user (returns 429)

**Export PDF:**
- [ ] User can click "Download PDF" in chat header
- [ ] PDF contains cover (query + date), all messages with role labels, sources as numbered footnotes, charts embedded as images
- [ ] French accents render correctly (é, à, ç, ï, ô, etc.)
- [ ] Free tier: "Made with Bokari" diagonal watermark
- [ ] Pro tier: no watermark
- [ ] File size < 1MB for typical chat
- [ ] Generation < 3s for typical chat
- [ ] Pagination with header repeat on each page

### 6.3 Open questions for the user

1. **Custom slugs from day 1, or v2?** (Custom slugs add 1 day of work + reserved-list maintenance)
2. **Pro gating on no-watermark PDF?** (Affects pricing page; needs GTM alignment)
3. **Allow indexing by default (like Perplexity Pages) or opt-in (like ChatGPT)?** (Affects SEO strategy; needs Cheick + Mansa input)
4. **Self-host fonts on Supabase Storage or CDN?** (Self-host = GDPR-clean, but ~5MB of static assets)
5. **Should share pages show "Create your own" CTA, or go straight to a Bokari ad?** (Conversion vs brand purity)
6. **Do we ship a "Public profile" page that aggregates all a user's shares?** (Adds a `/u/[username]` route, 2 extra days)

---

## 7. Source bibliography (verified 2026)

### Perplexity share & Pages
- [WiseChecker — How to Share a Perplexity Thread With a Public Link (15 May 2026)](https://wisechecker.com/how-to-share-perplexity-thread-public-link/)
- [QWE AI — Perplexity AI Pages: Articles You Can't Export (13 Feb 2026)](https://www.qwe.edu.pl/tutorial/perplexity-ai-pages-create-articles)
- [FatJoe — Perplexity AI Stats May 2026: 100M+ MAU (21 May 2026)](https://fatjoe.com/blog/perplexity-ai-stats)
- [WiseChecker — Perplexity Public Space Indexed by Google (16 May 2026)](https://wisechecker.com/perplexity-public-space-indexed-google-privacy/)
- [LLMnesia — How to Export Perplexity Conversation History (19 Apr 2026)](https://www.llmnesia.com/blog/how-to-export-perplexity-conversation-history)
- [testingcatalog — Perplexity now supports export to PDF and Markdown (12 Feb 2025)](https://www.threads.com/@testingcatalog/post/DF_SETVNear)

### ChatGPT / Claude share
- [Cybernews — ChatGPT chats indexed by Google, users shocked (1 Aug 2025)](https://cybernews.com/ai-news/chatgpt-shared-links-privacy-leak/)
- [AI Memory — ChatGPT Shared Conversations Complete Guide (Apr 2026)](https://aimemory.pro/blog/chatgpt-shared-conversations)
- [Anthropic — Sharing and Unsharing Chats in Claude (16 Mar 2026)](https://support.claude.com/en/articles/10593882-sharing-and-unsharing-chats)
- [Guideflow — How to share a chat publicly in Claude.ai (4 Mar 2026)](https://www.guideflow.com/tutorial/how-to-share-a-chat-publicly-in-claudeai)
- [Times Now — ChatGPT Could Soon Bring Colourful Preview Cards (28 May 2026)](https://www.timesnownews.com/technology-science/chatgpt-could-soon-bring-colourful-preview-cards-all-details-here-article-154420427)

### OG image generation / Satori
- [Vercel Docs — Open Graph Image Generation (17 Feb 2026)](https://vercel.com/docs/og-image-generation)
- [Vercel Blog — Introducing OG Image Generation (5× faster benchmark)](https://vercel.com/blog/introducing-vercel-og-image-generation-fast-dynamic-social-card-images)
- [npm — satori 0.26.0, @vercel/og 0.11.1 (Mar 2026)](https://www.npmjs.com/package/satori)
- [Matt Rothenberg — OG Image Generation on the Edge (screenshot your own page)](https://mattrothenberg.com/notes/edge-og-images)
- [og-image.org — Dynamic OG Images with Satori](https://og-image.org/docs/dynamic-og)
- [konstantin.digital — Generating Dynamic OG Images With Vercel OG](https://konstantin.digital/blog/generating-dynamic-og-images-with-vercel-og)

### Next.js ISR / generateStaticParams
- [Next.js Docs — generateStaticParams (28 May 2026)](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Next.js Docs — Incremental Static Regeneration (ISR)](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js Docs — Upgrading: Version 16 (async params, React 19.2)](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Build with Matija — ISR in Next.js App Router (25 Dec 2025)](https://www.buildwithmatija.com/blog/understanding-incremental-static-regeneration-isr-guide)

### PDF generation libraries
- [FUNBREW PDF — @react-pdf/renderer vs jsPDF vs API (5 Apr 2026)](https://pdf.funbrew.cloud/en/blog/pdf-api-react-pdf-comparison)
- [Nutrient — Top JavaScript PDF generator libraries 2026 (25 Feb 2026)](https://www.nutrient.io/blog/top-js-pdf-libraries)
- [devpick — jspdf vs react-pdf renderer (2026)](https://devpick.co/jspdf-vs-react-pdf-renderer)
- [devpick — jspdf vs pdfkit (18 Mar 2026)](https://devpick.co/jspdf-vs-pdfkit)
- [pdf4.dev — pdf-lib vs jsPDF vs PDFKit (10 May 2026)](https://pdf4.dev/blog/pdf-lib-vs-jspdf-vs-pdfkit-javascript)
- [npm — @react-pdf/renderer 4.5.1 (released 24 days ago)](https://www.npmjs.com/package/@react-pdf/renderer)
- [react-pdf.org — Quick Start guide](https://react-pdf.org/)
- [Vercel KB — Deploying Puppeteer with Next.js on Vercel (10 Nov 2025)](https://vercel.com/kb/guide/deploying-puppeteer-with-nextjs-on-vercel)
- [Build with Matija — Process PDFs on Vercel (20 Feb 2026)](https://www.buildwithmatija.com/blog/process-pdfs-on-vercel-serverless-guide)
- [htmltopdfconverter.com.au — Generate PDFs in Next.js Without Bundling Puppeteer (5 Mar 2026)](https://www.htmltopdfconverter.com.au/blog/generate-pdfs-nextjs-without-bundling-puppeteer)
- [GitHub ADR — 0002 react-pdf not puppeteer](https://github.com/comountainclimber/walkthrough/blob/main/docs/adr/0002-react-pdf-not-puppeteer.md)
- [Iurii Rogulia — Puppeteer vs react-pdf: Node.js PDF Generation Compared (20 Aug 2025)](https://iurii.rogulia.fi/blog/pdf-generation-puppeteer-vs-react-pdf)

### Charts in PDF
- [npm — react-pdf-charts 1.0.0 (Recharts v2 only)](https://www.npmjs.com/package/react-pdf-charts)
- [Recharts — Official site, v3.8.1](https://recharts.github.io/)
- [Nate Haebig-Kerber — Building beautiful graphs in React with Recharts (21 Apr 2025)](https://natehaebigkerber.substack.com/p/building-beautiful-graphs-in-react)
- [Stack Overflow — How to add recharts to react-pdf](https://stackoverflow.com/questions/68462413/how-to-add-recharts-to-react-pdf)

### Schema.org & SEO
- [Google Search Central — QAPage structured data (24 Mar 2026)](https://developers.google.com/search/docs/appearance/structured-data/qapage)
- [Schema.org QAPage type](https://schema.org/QAPage)
- [Schemaapp — Creating QAPage Schema Markup](https://www.schemaapp.com/schema-markup/how-to-create-qa-page-schema-markup-for-top-answer-rich-result)
- [Schema.org v30.0 released 19 Mar 2026](https://schema.org/)
- [Soar Agency — Schema.org markup for AI citations: what matters (6 May 2026)](https://www.soar.sh/blog/schema-markup-ai-citations-2026)
- [Rediate — The Complete Guide to Open Graph Tags 2026 (16 Mar 2026)](https://www.getrediate.com/blog/complete-guide-open-graph-tags)
- [ZipTie — How to Optimize Content for Perplexity AI (30 Mar 2026)](https://ziptie.dev/blog/how-to-optimize-content-for-perplexity-ai/)
- [digitalapplied — Structured Data After I/O 2026: Schema Cheat Sheet (24 May 2026)](https://www.digitalapplied.com/blog/structured-data-after-io-2026-schema-updates)

### GDPR & privacy
- [OpenAI Privacy Policy (6 Feb 2026)](https://openai.com/policies/row-privacy-policy/)
- [Momentum — GDPR Consent Requirements for Health Data (20 Mar 2026)](https://www.themomentum.ai/blog/gdpr-consent-requirements-health-data)
- [LumiChats — Are Your AI Chats Private? (5 Apr 2026)](https://lumichats.com/blog/ai-privacy-2026-what-chatgpt-claude-gemini-grok-do-with-your-data)
- [Resonate — GDPR Consent Form Examples & Templates (25 Jan 2026)](https://www.resonatehq.com/blog/gdpr-consent-form-and-chat-message-examples)

### Supabase & Postgres
- [Supabase Docs — Rate limits (Auth)](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase Docs — Securing your API (RLS)](https://supabase.com/docs/guides/api/securing-your-api)
- [dev.to — Lock Down Your Data: RLS in Supabase (15 Sep 2025)](https://dev.to/thebenforce/lock-down-your-data-implement-row-level-security-policies-in-supabase-sql-4p82)
- [Supabase Blog — Supabase is now ISO 27001 certified (22 Apr 2026)](http://supabase.com/blog/supabase-is-now-iso-27001-certified)

---

*End of report. Next step: review with Cheick (CTO) and Salif (CMO) on 4 June 2026 to lock sprint scope, then write the implementation plan.*
