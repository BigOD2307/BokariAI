# Sprint 4 — Perplexity UX, WhatsApp Auth, Virality & Learn Mode

> **Date** : 3 juin 2026 · **Auteur** : Soundiata (CEO) via OpenCode · **Status** : Plan validé par recherche, en attente GO Ousmane
> **Branche cible** : `feat/sprint-4-ux-auth` (et 1 branche par phase pour parallèle)

## TL;DR

Bokari doit devenir un **vrai concurrent de Perplexity** sur l'UX, tout en gardant nos 4 différenciateurs (NLI validator, multi-modal, speed, Africa-first). Le Sprint 4 livre **10 features** en **4 phases séquentielles** + **recherche approfondie complétée**. Estimation : 14-19 jours (1 dev) / 8-10 jours (2 devs en parallèle par phase).

**Recherche complète** : voir `docs/research/2026-06-03-sprint4-{auth,ux,virality,learn}.md` (4 fichiers, ~3000 lignes, 100+ sources 2026 vérifiées).

## Décisions cadres (validées 3 juin 2026 par Ousmane)

1. **Phase order** : Auth → UX → Virality → Learn (fondations d'abord)
2. **2 devs en parallèle** : Aoua (frontend) + Amadou (backend) sur phases Auth+UX, puis Virality+Learn
3. **Feature flags** : tout derrière `flags.sprint4.*` dans PostHog, kill switch si bug
4. **Pas de breaking change** : email signup reste actif, WhatsApp est en plus
5. **Guest mode d'abord** : on peut lancer guest mode sans WhatsApp, c'est la priorité conversion
6. **WhatsApp provider** : **Meta Cloud API direct** + custom OTP storage (pas Twilio Verify) — économie $0.055/OTP, +3-4 jours dev, code surface custom
7. **Public chats** : **tout indexé par défaut** + opt-out accessible mais pas proéminent. DPO + CGU Afrique renforcés avant le ship
8. **Learn mode** : **100% gratuit** (acquisition pure, monétisation via B2B écoles plus tard)
9. **Search depth** : **2 niveaux** (search / deep_search)

## Stack confirmée

- **Next.js 16.0.7** App Router, React 18, TypeScript strict, Tailwind 3.3, shadcn/ui `base-nova`
- **Supabase** Auth + Postgres + RLS, Drizzle ORM
- **Packages déjà installés** : `motion@^12.23.26`, `jspdf@^3.0.4`, `lucide-react`, `sonner`, `recharts`, `better-sqlite3`
- **Packages à ajouter** (Sprint 4) :
  - `react-international-phone@^4.8.0` (WhatsApp signup)
  - `libphonenumber-js` (déjà transitif via react-international-phone)
  - `@react-pdf/renderer@^4.5.1` (PDF export, Remplace jspdf pour le cas Bokari)
  - `react-pdf-charts@^1.0.0` (Recharts v2 → PDF wrapper)
  - `@vercel/og@^0.11.1` (Open Graph images)
  - `nanoid@^5.0.0` (share slugs, déjà probablement là)
  - `react-hotkeys-hook@^4.6.1` (Cmd+B, Cmd+K)
  - `@radix-ui/react-dialog@^1.1.6` (Sheet pour sidebar mobile)
  - `date-fns@^4.1.0` (date grouping)
  - `react-virtuoso@^4.12.3` (virtualization si > 100 items historique)
  - `@open-spaced-repetition/sm-2` (Learn mode SRS, MIT, 5 KB)
  - `cmdk@^1.0.0` (Cmd+K command palette, optionnel)

## Phase 1 — Auth (5 jours, 1 dev)

### 1.1 WhatsApp OTP signup (5 jours, +2j vs Twilio Verify pour custom code)

**Provider** : **Meta WhatsApp Business Cloud API direct** (PAS Twilio Verify — décision validée 3 juin 2026 par Ousmane). Coût : $0.004/OTP (5.4 cents économisés par signup vs Twilio).

**Architecture** : Custom OTP storage dans Supabase + custom JWT mint sur vérification réussie.

**Fichiers à créer** :
- `src/lib/auth/whatsapp/meta-client.ts` : wrapper Graph API `/v20.0/<phone-id>/messages` (envoi template `authenticate`) (120 LOC)
- `src/lib/auth/whatsapp/otp-store.ts` : `createOtp(phone, code, expiresAt)`, `verifyOtp(phone, code)`, `incrementAttempts(phone)`, `resetOtp(phone)` (90 LOC)
- `src/lib/auth/whatsapp/jwt.ts` : `mintSessionJwt(userId, phone)` via Supabase service_role + `signInWithIdToken` (60 LOC)
- `src/lib/auth/country.ts` : `getDefaultCountry()` lit `cf-ipcountry` Cloudflare, fallback `SN` (40 LOC)
- `src/components/Auth/PhoneInput.tsx` : wrapper `react-international-phone` + style shadcn (120 LOC)
- `src/components/Auth/OtpInput.tsx` : 6-digit OTP avec auto-submit + countdown resend (100 LOC)
- `src/app/api/auth/whatsapp/start/route.ts` : POST, valide E.164, génère OTP 6-digit (hash bcrypt), stocke, appelle Meta
- `src/app/api/auth/whatsapp/verify/route.ts` : POST, vérifie OTP + attempts < 3, mint JWT, set session cookie
- `src/app/api/auth/whatsapp/webhook/route.ts` : GET webhook Meta (delivery status), ajuste UX (SMS fallback optionnel Sprint 5)
- `src/components/Auth/WhatsAppAuthModal.tsx` : orchestrateur (étape 1: phone, étape 2: code) (200 LOC)
- Migration Supabase :
  ```sql
  create table phone_otps (
    phone text primary key,            -- E.164 format
    code_hash text not null,           -- bcrypt(code, 10)
    attempts int default 0,
    expires_at timestamptz not null,
    last_sent_at timestamptz default now(),
    verified_at timestamptz,
    created_at timestamptz default now()
  );
  create index phone_otps_expires_idx on phone_otps(expires_at);
  
  alter table users add column phone_whatsapp text unique;
  alter table users add column phone_verified_at timestamptz;
  ```

**Modifications** :
- `src/lib/hooks/useAuth.tsx` : ajout `signInWithWhatsApp(phone)`, `verifyWhatsAppOtp(phone, code)`
- `src/components/AuthModal.tsx` : onglet "Email" / "WhatsApp" (tabs shadcn)
- `src/middleware.ts` (ou `proxy.ts` Next.js 16) : lire `cf-ipcountry`, set cookie `_country`

**Variables d'env** :
- `META_WHATSAPP_TOKEN` (EAA... permanent token)
- `META_WHATSAPP_PHONE_ID` (numeric ID)
- `META_WHATSAPP_WABA_ID` (WhatsApp Business Account ID)
- `META_WHATSAPP_TEMPLATE_NAME` (default: `bokari_otp`)

**Rate limiting** : in-memory bucket (max 5 OTPs/phone/hour, 30 OTPs/IP/hour) + DB-persisted counter. Resend cooldown : 30s, expiré : 5min.

**Tests** : 50+ nouveaux (mock Meta Graph API, E.164 parsing, bcrypt verify, attempts increment, rate limit, JWT mint)
**Docs** : `docs/auth/whatsapp.md` (setup Meta WABA, business verification, template approval, env vars)

**Setup requis avant dev** :
- Facebook Business verification (1-3 jours)
- WABA creation + phone number registration
- Template `bokari_otp` submission (24-72h approval)
- Rate testing avec Meta test number

### 1.2 Guest mode + blur (2 jours)

**Pattern** : "show the work, hide the answer" — full pipeline (search, sources, charts, agent steps), blur sur `text` LLM, overlay avec CTA WhatsApp.

**Fichiers à créer** :
- `src/lib/auth/guest.ts` : `getGuestSession()` lit cookie `_bk_anon`, retourne `{ id, queriesCount, lastReset }` (60 LOC)
- `src/lib/auth/rate-limit.ts` : 3 queries / 24h sliding window, Redis-free (in-memory + DB sync) (80 LOC)
- `src/components/Message/BlurredResponse.tsx` : overlay blur(8px) + CTA "Continuer sur WhatsApp" (90 LOC)
- `src/app/api/guest/track/route.ts` : POST incrément queries, reset daily
- `src/app/api/turnstile/verify/route.ts` : Cloudflare Turnstile (optionnel, pour > 100 queries/jour)

**Modifications** :
- `src/lib/hooks/useChat.tsx` : `useGuestSession()` hook, si guest + queries > 3, return `text: null`
- `src/components/Chat.tsx` : passe `isGuest` aux blocs
- `src/lib/agents/search/index.ts` : emit `browseMode: 'guest'` event, le client sait blur
- `src/components/Auth/WhatsAppAuthModal.tsx` : `?from=guest` query param, auto-fill phone from input

**Tests** : 20+ nouveaux (cookie expiry, rate limit, blur, CTA)
**Conversion cible** : 8-12% guest → signup

### 1.3 Persistent session (1 jour, vérif)

**Action** : audit + fix éventuel, pas de nouveau code.

**Checklist** :
- [ ] `proxy.ts` (Next.js 16) appelle `getUser()` pas `getSession()`
- [ ] Utilise `getAll`/`setAll` (pas `get`/`set`) pour cookies
- [ ] `await cookies()` partout dans les Server Components
- [ ] `autoRefreshToken: true` dans `createBrowserClient`
- [ ] Pas de `localStorage` côté serveur

**Décision** : defaults Supabase 2026 OK (1h access, refresh infini V2, 12 min auto-refresh). Pas de changement de config.

**Fichiers** : audit report `docs/auth/session-audit.md` (pas de code)

## Phase 2 — UX Perplexity (5 jours, 1 dev frontend)

### 2.1 Sidebar (3 jours)

**Pattern Perplexity** : top (logo + collapse), shortcuts, divider, history band (NOUVEAU), bottom (profile).

**Fichiers à modifier** :
- `src/components/Sidebar.tsx` (244 → ~350 LOC) :
  - Ajouter `<HistoryBand />` entre Navigation et Profile
  - Header mobile : hamburger button au lieu de `Link /`
  - Collapse state : `localStorage.getItem('bokari.sidebar.collapsed')`
  - Animation : `motion` slide + fade overlay (250ms)
- `src/components/Sidebar/HistoryBand.tsx` (NOUVEAU, 180 LOC) : liste chats, search field, date grouping
- `src/components/Sidebar/MobileSheet.tsx` (NOUVEAU, 100 LOC) : Radix Dialog pour mobile
- `src/components/Sidebar/HistoryItem.tsx` (NOUVEAU, 60 LOC) : titre + preview + delete

**Fichiers à créer** :
- `src/app/api/chats/list/route.ts` : GET chats avec cursor pagination, group par date
- `src/app/api/chats/[id]/route.ts` : GET (single), DELETE (soft delete), PATCH (rename)

**Modifications DB** :
- Migration : `alter table chats add column updated_at timestamp default now();`
- Migration : `create index chats_user_updated_idx on chats(user_id, updated_at desc);`
- Migration : `create index chats_title_search_idx on chats using gin(to_tsvector('french', title));`

**Tests** : 25+ nouveaux (HistoryBand render, group logic, virtual scroll)

### 2.2 Auto-naming (1 jour)

**Pattern** : après premier message, async LLM call GPT-4o-mini, PATCH `chats.title`. Coût : $0.01/100 titres.

**Fichiers à créer** :
- `src/lib/agents/title.ts` : `generateTitle(firstMessage)` (40 LOC)
- `src/app/api/chats/[id]/title/route.ts` : PATCH titre

**Modifications** :
- `src/lib/hooks/useChat.tsx` : après premier `message` event, fire-and-forget `fetch('/api/chats/${id}/title', { method: 'PATCH' })`

**Tests** : 8+ nouveaux (mock OpenAI, fallback truncation, RLS)

### 2.3 Keyboard shortcuts (1 jour)

**Fichiers à créer** :
- `src/lib/hooks/useShortcuts.ts` : Cmd+B (toggle sidebar), Cmd+K (new thread), Cmd+Shift+O (history) (60 LOC)

**Modifications** :
- `src/components/Sidebar.tsx` : bind `useShortcuts`
- `src/components/Chat.tsx` : Cmd+K → `router.push('/')`

**Tests** : 10+ nouveaux (hook unit)

## Phase 3 — Virality (3 jours, 1 dev)

### 3.1 Share chat (2 jours)

**Route** : `bokari.ai/p/<nanoid(12)>` avec ISR `revalidate=3600`.

**Fichiers à créer** :
- `src/app/p/[slug]/page.tsx` (180 LOC) : page publique avec messages, sources, charts, footer CTA
- `src/app/p/[slug]/opengraph-image.tsx` (80 LOC) : `@vercel/og` avec Satori, 1200x630
- `src/app/p/[slug]/not-found.tsx` (20 LOC)
- `src/app/api/shares/route.ts` : POST create, DELETE revoke
- `src/app/api/shares/[id]/route.ts` : GET stats
- `src/components/MessageActions/ShareButton.tsx` (100 LOC) : modal avec copy link
- `src/lib/db/schema/shares.ts` : Drizzle schema (voir recherche §2.2)
- Migration : tables `shares`, `share_views` + RLS

**Modifications** :
- `src/components/MessageActions/index.tsx` : ajouter ShareButton
- `src/lib/hooks/useChat.tsx` : `createShare(chatId)` action

**JSON-LD** : `QAPage` + `Article` schema
**Defaults** : `is_indexed=true` (décision Ousmane 3 juin 2026 : tout indexé par défaut, opt-out dans Settings > Privacy > Public chats — **caché**, pas dans le share modal). `anonymous_author=false` (par défaut le user est nommé). DPO + CGU Afrique renforcés avant le ship.
**OG image** : `runtime = 'edge'`, font Inter TTF bundled
**Settings UI** : `/settings/privacy` → section "Public chats" avec toggle "Autoriser Google à indexer mes chats partagés" (par défaut ON)

**Tests** : 30+ nouveaux (share creation, RLS, OG image, JSON-LD)

### 3.2 Export PDF (1 jour)

**Library** : `@react-pdf/renderer@^4.5.1` server-side, pas jspdf (jspdf est déjà là mais limité). Coût : ~1.2s / PDF, 280KB typique.

**Fichiers à créer** :
- `src/lib/pdf/ChatDocument.tsx` (200 LOC) : cover page, messages, sources, charts via `react-pdf-charts`
- `src/lib/pdf/fonts.ts` : bundle Inter TTF (regular, bold) pour accents français
- `src/app/api/export/pdf/route.ts` : POST `{ chatId }`, return `application/pdf`
- `src/components/MessageActions/ExportPdfButton.tsx` (80 LOC)

**Modifications** :
- `src/components/MessageActions/index.tsx` : ExportPdfButton à côté de ShareButton
- Migration : watermark "Made with Bokari" pour free users (détection via `user.plan`)

**Tests** : 15+ nouveaux (PDF generation, fonts, charts, watermark)

## Phase 4 — Learn mode (7 jours, 1 dev fullstack)

### 4.1 Mode Learn (Socratic + flashcards + quiz) (4 jours, -1j car pas de paywall)

**Pattern Perplexity/ChatGPT** : toggle `+ Apprendre` dans input bar → system prompt Socratic → inline flashcards + quiz. **100% gratuit, pas de limite** (décision Ousmane 3 juin 2026 : acquisition pure, monétisation B2B écoles plus tard).

**Fichiers à créer** :
- `src/lib/agents/learn/prompt.ts` (60 LOC) : Socratic system prompt FR
- `src/lib/agents/learn/generator.ts` (100 LOC) : `generateFlashcards(text, count)`, `generateQuiz(text, count)` via GPT-4o-mini
- `src/lib/db/schema/flashcards.ts` : Drizzle schema
  ```ts
  flashcards: { id, userId, chatId, question, answer, difficulty, lastReviewed, nextReview, sm2Data }
  quizAttempts: { id, userId, flashcardId, isCorrect, reviewedAt }
  ```
- Migration : tables `flashcards`, `quiz_attempts` + RLS
- `src/components/MessageRenderer/FlashcardBlock.tsx` (180 LOC) : carte flip CSS 3D, rate buttons (1-4)
- `src/components/MessageRenderer/QuizBlock.tsx` (150 LOC) : MCQ avec feedback
- `src/components/MessageInput/LearnToggle.tsx` (80 LOC) : ajout dans menu `+`
- `src/lib/agents/learn/sm2.ts` : wrapper `@open-spaced-repetition/sm-2` (40 LOC)
- `src/app/api/flashcards/route.ts` : GET list, POST create from chat
- `src/app/api/flashcards/[id]/review/route.ts` : POST `{ rating: 1-4 }` → update SM-2
- `src/app/api/flashcards/review/route.ts` : GET due cards today

**Modifications** :
- `src/lib/agents/search/index.ts` : si `mode === 'learn'`, emit `flashcard` + `quiz` events
- `src/lib/hooks/useChat.tsx` : handler `flashcard` + `quiz`
- `src/components/MessageInput/MessageInputActions.tsx` : ajout `<LearnToggle />`

**Coût** : $0.004/session GPT-4o-mini ou $0.002/session Gemini Flash
**Limite** : AUCUNE (gratuit illimité). Budget cible : < $2k/mois Learn (50k users × 0.5 sessions/j × 30% × $0.004)

**Tests** : 40+ nouveaux (SM-2, card flip, quiz scoring, RLS)

### 4.2 Page "Mes fiches" (1 jour)

**Route** : `/library` (existe déjà, à enrichir) avec onglet "Fiches".

**Fichiers à créer** :
- `src/app/library/flashcards/page.tsx` (150 LOC) : liste flashcards, due today, due this week
- `src/components/Flashcards/ReviewSession.tsx` (180 LOC) : session de révision, keyboard 1-4

**Tests** : 15+ nouveaux (review session, daily reset)

### 4.3 Daily reminder (1 jour)

**Pattern** : Web Push API, opt-in, Supabase Edge Function.

**Fichiers à créer** :
- `supabase/functions/send-daily-reminder/index.ts` (100 LOC) : cron 18:00 UTC, notif utilisateurs avec due cards
- `public/sw.js` (50 LOC) : service worker pour push
- `src/components/Settings/NotificationsToggle.tsx` (80 LOC)

**Tests** : 10+ nouveaux (push permission, opt-in, cron)

## Coût total Sprint 4

| Poste | Coût / mois (10k users) |
|-------|------------------------|
| WhatsApp OTP (Twilio Verify + Meta) | ~$900 |
| Cloudflare Turnstile | $0 (free tier) |
| Vercel (ISR + Edge functions) | $20 (Pro plan) |
| LLM Learn mode (GPT-4o-mini, illimité × 10k users × 30% × 0.5 sessions/j) | $1,800 |
| Storage shares (Postgres, 10k shares × 50KB) | $5 |
| Bandwidth (OG images, ISR cache) | $15 |
| **Total infra** | **~$2,740/mo à 10k users** |
| LLM auto-title (10k threads/j) | $1/j = $30/mo |
| **Total marginal** | **~$2,770/mo** |

À 100k users : ~$15k/mois (rentable si ARPU > $1.50).

## Métriques cibles (3 mois post-launch)

| Métrique | Avant | Cible Sprint 4 |
|----------|-------|----------------|
| Signup conversion (guest → WhatsApp) | 0% | 8-12% |
| Signup cost | (email) ~$0.10 | (WhatsApp) $0.059 |
| Daily active users (DAU) | baseline | +25% (sidebar history) |
| Virality (shares) | 0 | 100/j → 1k/j en 90j |
| PDF exports | 0 | 50/j (pro users) |
| Learn session / DAU | 0 | 0.5 (stickiness++) |
| 30-day retention | baseline | +10pt (Learn streaks) |

## Fichiers créés (résumé)

| Type | Count | LOC total |
|------|-------|-----------|
| Nouveaux composants React | 12 | ~1,800 |
| Nouveaux API routes | 11 | ~700 |
| Migrations Supabase | 6 | ~200 |
| Nouveaux fichiers lib | 8 | ~600 |
| Tests | 30 fichiers | ~2,000 |
| Docs | 4 | ~500 |
| **Total** | **~70 fichiers** | **~5,800 LOC** |

## Risques & open questions

1. **Twilio Verify WhatsApp** : "Contact sales to request access" peut être lent (1-2 semaines de setup)
2. **Cloudflare Turnstile** : Bokari est derrière Cloudflare déjà ? À vérifier
3. **Meta WABA approval** : 24-72h pour template `authenticate` OTP
4. **`@react-pdf/renderer` SSR** : fonctionne en Node.js runtime (pas edge), vérifier config Vercel
5. **`@vercel/og` runtime='edge'** : fonts bundling, 1MB max
6. **SM-2 vs FSRS-6** : ship SM-2, FSRS-6 quand > 1k reviews/user
7. **PDF generation concurrente** : limite Vercel 50MB function, ~4MB cold start React-PDF
8. **ChatGPT indexing scandal (août 2025)** : default `noindex=true` pour partager chat (GDPR)
9. **Public chats + RGPD** : opt-in explicite, anonymisation par défaut
10. **Code coverage Learn mode** : minimum 80% (Sprint 4 invariant)

## Liens recherche

- `docs/research/2026-06-03-sprint4-auth.md` — WhatsApp + session + guest (67 KB, 1900 lignes)
- `docs/research/2026-06-03-sprint4-ux.md` — Sidebar + history + search depth (52 KB, 940 lignes)
- `docs/research/2026-06-03-sprint4-virality.md` — Share + PDF (47 KB, 850 lignes)
- `docs/research/2026-06-03-sprint4-learn.md` — Learn mode (38 KB, 660 lignes)

## Next steps

1. **Validation Ousmane** : GO/NO-GO sur ce plan + stack choix (Twilio vs Meta direct ?)
2. **Setup Twilio + Meta WABA** : 1-2 jours de paperwork en parallèle
3. **Sprint kickoff Phase 1** : créer branche `feat/sprint-4-phase1-auth`
4. **Subagent dispatch** : 2 subagents en parallèle (frontend Aoua, backend Amadou)

## Liens Obsidian

- [[Bokari]] · [[Bokari Index]] · [[Bokari Roadmap Sprint 4]] · [[Bokari Performance Architecture]]
- [[2026-06-02 - Sprint 1 Citation Validator NLI]] · [[2026-06-02 - Sprint 2 Multi-modal]] · [[2026-06-02 - Sprint 3 Speed Cache SSE]]

---

Tags : #bokari #sprint-4 #plan #perplexity-ux #whatsapp #learn-mode
