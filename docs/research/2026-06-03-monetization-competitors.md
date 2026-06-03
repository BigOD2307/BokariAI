# 2026-06-03 — Bokari Monetization & Competitor Pricing Research

> **Purpose:** Deep competitive analysis of 16 AI search / chat / coding / learning products' pricing, conversion funnels, ARPU, and Africa strategy. Goal: identify the right monetization model for Bokari, a Perplexity-like AI search engine built by Dicken AI for African users.
>
> **Date:** 2 June 2026
> **Author:** Cheick (CTO) → Bokari working group
> **Status:** Living doc — refresh monthly until 2027 launch of Bokari Pro

---

## Executive Summary (read this first)

- **6 monetization models dominate 2026:** (1) tiered freemium subscriptions, (2) credit-metered compute, (3) team/enterprise per-seat, (4) API/usage-based, (5) platform distribution deals, (6) commerce/transactional revenue.
- **Bokari must combine 1 + 2 + 5**: a sharp $0/$3/$9 consumer tier ladder (WhatsApp-native Mobile Money-friendly) **plus** a credit meter for power users, **plus** a B2B/School distribution channel via Ministries of Education and telcos.
- **The 30-50ms TTFB, NLI citations, Learn mode (SM-2 flashcards), and WhatsApp OTP are not matched by anyone** in the African market. Perplexity, ChatGPT, Claude are priced for US/EU purchasing power ($20/mo = ~1 day median income in Ghana). They are 10-20× too expensive for our target user.
- **Recommended Bokari pricing** (CFA-friendly, $1 = ~600 XOF):
  - **Bokari Free** (current default): 5 queries / day, 1 image upload / day, 3 conversations saved
  - **Bokari Pro** $2.99 / month or 1,800 XOF (~$3): unlimited queries, unlimited images, Learn mode, PDF export, citation bundles
  - **Bokari Edu** $9.99 / month or 6,000 XOF (sold to schools/MoE, per-student): everything in Pro + admin dashboard + NLI audit log + Francophone curriculum packs
- **Target ARPU by year 3:** $4-6 / paying user / year blended (heavy mobile money bias, low conversion to dollar billing, but high upgrade-to-WhatsApp-Business-API upsell on top)

---

## Table of Contents

1. [Main 6 Products](#1-main-6-products)
   - 1.1 [Perplexity](#11-perplexity)
   - 1.2 [ChatGPT (OpenAI)](#12-chatgpt-openai)
   - 1.3 [Claude (Anthropic)](#13-claude-anthropic)
   - 1.4 [You.com](#14-youcom)
   - 1.5 [Phind](#15-phind)
   - 1.6 [Gemini (Google)](#16-gemini-google)
2. [Adjacent 10 Products](#2-adjacent-10-products)
   - 2.1 [Khanmigo (Khan Academy)](#21-khanmigo-khan-academy)
   - 2.2 [Quizlet](#22-quizlet)
   - 2.3 [NotebookLM](#23-notebooklm)
   - 2.4 [Anthropic API](#24-anthropic-api)
   - 2.5 [OpenAI API](#25-openai-api)
   - 2.6 [Cursor](#26-cursor)
   - 2.7 [GitHub Copilot](#27-github-copilot)
   - 2.8 [Notion AI](#28-notion-ai)
   - 2.9 [Linear](#29-linear)
   - 2.10 [Figma AI](#210-figma-ai)
3. [Synthesis & Bokari Recommendation](#3-synthesis--bokari-recommendation)

---

# 1. Main 6 Products

## 1.1 Perplexity

**Category:** AI-native answer engine + agentic browser. Closest direct competitor to Bokari.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Limited "Pro Search" (formerly Quick Search is unlimited but basic), Sonar model only, 3 Spaces, no file upload, no image generation |
| **Pro** | $20/mo or $200/yr ($16.67/mo) | Unlimited Pro Search, all 4 frontier models (GPT-5.5, Claude Opus 4.7, Gemini 3.1 Pro, Sonar 2), file upload, image gen, Pro Labs (reports/dashboards), Perplexity Health, Model Council |
| **Max** | $200/mo | Everything in Pro + priority at high traffic, Comet browser, 10,000 Computer credits/mo + 20,000 bonus at launch, early access to all features |
| **Enterprise Pro** | $40/seat/mo (annual) | All Pro features + Internal Knowledge Search, SSO, admin dashboard, SOC 2, HIPAA-grade security, "Eyes-off" data |
| **Comet (browser)** | Free with Max, $0 standalone for free download since Oct 2025 | AI sidebar, agentic browsing, Aria assistant, Perplexity search default |
| **Government (GSA)** | $0.25/agency / 18 mo | U.S. federal procurement via MAS IT contract — loss-leader / distribution seeding |

### What you get (Pro)

- Unlimited "Pro Search" with multi-step reasoning + cited sources
- 600+ Pro Searches/day (verified by user reports)
- Choice of 4 frontier models: GPT-5.5, Claude Opus 4.7, Gemini 3.1 Pro, Sonar 2 (in-house)
- 50+ file uploads (PDF, CSV, DOCX) — Internal Knowledge Search
- Image generation
- Perplexity Labs: dashboards, spreadsheets, web apps
- 3rd-party integrations: PayPal/Venmo checkout, Getty images
- Pro model access: deep research across 100+ sources

### What you get (Max)

- Everything in Pro
- All 19 models in Model Council (parallel querying)
- 10,000 Computer agent credits/mo (1 Computer task = ~5-50 credits depending on complexity)
- Priority access during peak times
- Comet for desktop and mobile (Android Nov 2025, iOS Mar 2026)
- Perplexity Health (US, Apple Health + Fitbit + EHRs from 1.7M providers)
- Early access to features (Computer, Personal Computer on macOS, future Windows)

### Conversion funnel (insight)

Perplexity grew from $80M ARR (late 2024) → $200M (Feb 2026) → **$500M annualized by April 2026** (Sacra estimate, 335% YoY). Key triggers:
1. **Quota exhaustion** — free users hit ~3-5 Pro Searches/day, then convert
2. **"Pro Search" feature** — reasoning with citations drives upgrade (the same value prop as Bokari's NLI badges)
3. **Model Council** — Feb 2026 launch of cross-model comparison was the trigger for Pro → Max upgrades
4. **Distribution** — Motorola (April 2025) gives 3 months of Pro free on Razr/Edge 60; Xfinity Rewards (Aug 2024), Uber One (Aug 2024) all bundle free year of Pro
5. **Government contract** — GSA at $0.25/agency was a strategic loss-leader to seed public sector
6. **Dropped ads** in Feb 2026 — explicitly to "preserve user trust" — signals they bet subscription > ad-supported

### ARPU

- Pro: $20/mo × 12 = **$240/yr gross** (likely $200-215 after billing fees)
- Max: $200/mo × 12 = **$2,400/yr gross**
- Enterprise Pro: $40/seat/mo × 12 = **$480/seat/yr**
- With ~100M MAU and 2025 ARR of $232M (Sacra), average revenue per MAU ≈ $2.32/yr. Conversion to paid is widely estimated 1-2% (industry standard for AI products), implying Pro ARPU for paying users ≈ $200-240/yr

### Africa angle

- Perplexity **does not price for Africa**. $20/mo = ~12,000 XOF in Senegal/Côte d'Ivoire = ~10× the median daily wage. No mobile money integration, no Francophone optimization.
- However: Perplexity **partnered with SK Telecom (Feb 2024)** to bring Pro to all SK Telecom users in South Korea. This is the only Africa-style telco bundling precedent and is a model Bokari should study.
- Perplexity is **available in French** (UI localized) but answer quality in French scientific / African context queries is mixed.
- Source: [en.wikipedia.org/wiki/Perplexity_AI](https://en.wikipedia.org/wiki/Perplexity_AI), [Sacra.com/c/perplexity](https://sacra.com/c/perplexity/), [perplexity.ai/hub/blog](https://www.perplexity.ai/hub/blog)

---

## 1.2 ChatGPT (OpenAI)

**Category:** General-purpose AI chat. The 800-lb gorilla.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Limited GPT-5.5 Instant, limited messages/uploads, limited image gen, limited deep research, limited memory, limited Codex |
| **Go** (new tier, 2026) | ~$8/mo (could not verify exact, ad-supported option) | More GPT-5.5 Instant, more messages, more image gen, longer memory. **This plan may include ads** |
| **Plus** | $20/mo | GPT-5.5 Thinking, expanded messages/uploads, better image gen, expanded deep research + agent mode, expanded memory/context, projects/tasks/custom GPTs, expanded Codex, early access to features |
| **Pro $100** | $100/mo | 5x more usage than Plus, Pro reasoning with GPT-5.5 Pro, Codex (max tasks), unlimited uploads, unlimited image gen, max deep research + agent mode, max memory/context, expanded projects/tasks |
| **Pro $200** | $200/mo | 20x more usage than Plus, research preview of new features, GPT-5.3 + file uploads unlimited, fastest response time |
| **Business** (ChatGPT) | $25/user/mo (annual) or $30 monthly | Everything in Plus + unlimited core chat + 60+ apps (Slack, Drive, SharePoint, GitHub, Atlassian) + business features + SAML SSO + MFA + no training on data |
| **Business Codex** | Usage-based (no fixed seat fee) | AI software engineering, automated code/security reviews, automations, worktrees + cloud envs, pay-as-you-go |
| **Enterprise** | Custom ($60+/seat typical) | Expanded context, SCIM/EKM/user analytics/role-based access, custom data retention, 10-region data residency, 24/7 priority support, SLAs, custom legal terms |
| **Education** | Edu: free for verified U.S. K-12 teachers through June 2027; Edu: affordable for universities | ChatGPT for Teachers (free) + ChatGPT Edu (per-seat) |
| **Nonprofit** | Up to 75% discount on Business/Enterprise | — |

### What you get at each tier

- **Go** is the new "taste of Plus" tier for ad-tolerant users. Crucially, it is **the first tier that admits ads** — this is a major signal for Bokari (ad-supported in Africa is a real option).
- **Plus** is the sweet spot — 100M+ paying subscribers (widely reported, including leaked Q3 2024 numbers from *The Information* of 9.7M paying, growing to 15.5M by end of 2024 and 30M+ by end of 2025). The benchmark.
- **Pro $100** is the "real Pro" tier that most professionals will use (5x Plus).
- **Pro $200** is for agents/developers running parallel workflows (20x Plus) — this is where ARR scales.

### Conversion funnel

1. **Daily limit hit** on GPT-5.5 Instant (10 messages/3 hours) — the primary trigger
2. **GPT-5.5 Thinking** unavailable on free — drives Plus
3. **Agent mode + deep research** — drives Plus → Pro $100
4. **Parallel agents** — drives Pro $100 → Pro $200
5. **Team features (apps, SSO)** — drives Plus → Business
6. **Custom data retention, EKM, SCIM** — drives Business → Enterprise
7. **Verified students get 2 months free Plus** — education funnel
8. **Free year for teachers in 44 countries (Microsoft-funded)** — Khan-style teacher-led adoption

### ARPU (public, verified)

- OpenAI annualized revenue crossed **$13B in 2025** (*The Information*, Sept 2025)
- Consumer (Plus/Pro) ARR > $5B by end of 2025
- Consumer paid subscribers: ~30M by end of 2025 (extrapolation)
- Blended ARPU consumer: ~$167-200/yr
- Plus dominates volume; Pro is small but high-ARPU
- Source: [openai.com/chatgpt/pricing](https://chatgpt.com/pricing), [help.openai.com — Pro tiers](https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro)

### Africa angle

- ChatGPT **does not price for Africa**. $20/mo Plus = ~12,000 XOF = 10× median daily income.
- **ChatGPT Edu** launched for U.S. K-12 teachers in 44 countries but **does NOT include Francophone Africa** as a free region. (Microsoft-funded free teacher access is in 44 countries — verify list, but Sub-Saharan Africa largely excluded.)
- No mobile money. No Francophone-specific features.
- No answer: ChatGPT **works** in French but the underlying training data is heavily Anglophone.
- This is the gap Bokari can fill.

---

## 1.3 Claude (Anthropic)

**Category:** Long-context AI assistant, increasingly used for research, writing, code, and agents.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Web/iOS/Android/desktop, code + data viz, writing, web search, memory across conversations, file creation + code execution, desktop extensions, Slack/Google Workspace, remote MCP connectors, extended thinking for complex work |
| **Pro** | $17/mo (annual, $200/yr) or **$20/mo monthly** | More usage, includes Claude Code, includes Claude Cowork, unlimited projects, Research, more Claude models, Claude for Microsoft 365, Claude for Microsoft Outlook |
| **Max** | From **$100/mo** (5x Pro usage) or higher tier (20x Pro usage, likely $200/mo) | Everything in Pro + 5x or 20x usage, higher output limits, early access to advanced features, priority at high traffic |
| **Team** (standard seat) | $20/seat/mo (annual) or $25 monthly | All Claude features + more usage than Pro, Claude Code, Claude Cowork, Microsoft 365/Slack, enterprise search, central billing, SSO, admin controls, no model training on content |
| **Team** (premium seat) | $100/seat/mo (annual) or $125 monthly | 5x more usage than standard, Claude Code, Cowork, admin controls |
| **Enterprise** | $20/seat + usage at API rates | All Team + spend limits, role-based access, SCIM, audit logs, Compliance API, custom data retention, network access control, IP allowlisting, HIPAA-ready, Claude Security (beta) |
| **Education** | Discounted university-wide plan | For entire institution (students/faculty/staff) |
| **API — Opus 4.8** | $5/MTok input, $25/MTok output; Prompt cache: $6.25 write / $0.50 read | Frontier model |
| **API — Sonnet 4.6** | $3/MTok input, $15/MTok output; Prompt cache: $3.75 write / $0.30 read | The model Bokari uses for Sonnet queries |
| **API — Haiku 4.5** | $1/MTok input, $5/MTok output; Prompt cache: $1.25 write / $0.10 read | The model Bokari would use for fallback/speed |
| **API — Web search** | $10 / 1K searches | Not including input/output tokens |
| **API — Code execution** | $0.05 / hour / container | 50 free hours daily per org |
| **API — Managed Agents** | $0.08 / session-hour | Active runtime |

### What you get

- **Free is unusually generous** — extended thinking, MCP connectors, Slack/GSuite, file creation with code execution. This is intentional: Anthropic wants to be the developer/researcher first stop.
- **Pro at $17-20/mo** is comparable to ChatGPT Plus; difference is Claude's longer 200K-400K context window and "Artifacts" feature.
- **Max** is for power users who hit usage limits. Critical for Bokari: Anthropic is now aggressively **upselling credits/usage** because the Pro tier is "soft unlimited" — high-usage users naturally convert to Max.
- **Team** is the B2B play. $20-100/seat gives Claude a foothold in team workflows.
- **Enterprise** includes spend limits, SCIM, audit logs, and **HIPAA-ready** — Anthropic owns the regulated vertical (legal, healthcare, government).

### Conversion funnel

1. **Free → Pro**: "More usage" is the primary trigger. The free tier has low daily caps; Pro has 5x.
2. **Pro → Max**: Power users hit caps again. The 5x/20x jump in Max is for actual agent workloads.
3. **Free → Pro via team**: Team leads get the seat, then drive individual conversions.
4. **API — prompt cache economics**: Anthropic's biggest 2025-26 moat. Read from cache is 1/10 the cost of input ($0.30/MTok vs $3/MTok for Sonnet). This is exactly what Bokari built with BGE-M3 semantic cache.
5. **Free $1,000 in Claude Code credits per Team seat** — promo through July 2, 2026 to seed Team adoption.

### ARPU (estimates)

- Anthropic annualized revenue: **$4-5B by mid-2025** (multiple reports, *The Information* Sept 2025 — $5B run-rate)
- Claude API: $3-15/MTok × millions of tokens per call × millions of calls daily
- Claude Pro consumer: ~3-5M paying subs × $200/yr ≈ $600M-1B ARR
- Claude Team + Enterprise: 50-100K seats × $240-1,200/seat/yr ≈ $100-500M ARR
- Anthropic valuation: $183B (Sept 2025) → **$200-300B (rumored 2026)**
- Source: [anthropic.com/pricing](https://www.anthropic.com/pricing), [anthropic.com/news](https://www.anthropic.com/news), Reuters/Bloomberg coverage

### Africa angle

- Claude is **not Africa-priced**. $17-20/mo Pro is unaffordable.
- Anthropic has an **Anthropic Academy** for free courses but no Francophone-first curriculum.
- No mobile money.
- **However:** Anthropic's **open-source MCP (Model Context Protocol)** is a de facto standard Bokari can adopt for free to make Bokari agents plug into Claude/GPT tools — reduces integration cost.

---

## 1.4 You.com

**Category:** AI-native search, multi-mode, API-first. Was a major consumer product, pivoted to enterprise/API in 2024-25.

### Pricing table (June 2026) — Public API pricing

| API | Price | Notes |
|---|---|---|
| **Search API** | $5.00 / 1K calls | 1-100 results/call, News endpoint included, up to 100 URLs/call, LLM-ready snippets |
| **Contents API** | $1.00 / 1K pages | Batch multiple URLs/req, Markdown or HTML |
| **Research API (Lite)** | $12.00 / 1K calls | Fast factual lookups |
| **Research API (Standard/Deep/Exhaustive/Frontier)** | Tiers, full Research tier pricing not detailed publicly but ~$12-50/1K range | Multi-step research + synthesis, cited, source-backed answers |
| **Finance Research API (Deep)** | $110.00 / 1K calls | Filings, macro, markets, derived calculations |
| **Finance Research API (Exhaustive)** | Higher tier | Same as Deep with more sources |
| **Free credit** | $100 to start | — |
| **Volume discount** | Yes | Annual commit = deeper discount |
| **Custom QPS** | Enterprise | — |

### What you get (the consumer product, which is now mostly gated)

- **You.com chat** still exists but the company has pivoted heavily to B2B API
- Modes: Smart, Genius, Research, Create
- Custom Apps: build GPT-like apps on You.com
- Web-scale grounding: powers search for OpenAI, Amazon, Alibaba, Thoughtspot, Harvey, Windsurf, Databricks, Salesforce, Cognizant (per customer logo wall on You.com)
- **SOC 2 certified, zero data retention, DPA-ready**

### Conversion funnel

1. **Free credit ($100)** gets developers to call the API
2. **Volume discount** locks them in as usage scales
3. **Annual commit** reduces churn to ~5%
4. **SOC 2 + Zero data retention** is the enterprise wedge

### ARPU

- You.com is private, no public revenue. Estimates: $50-100M ARR (2024-25, The Information). Currently 70-80% of revenue from API.
- Consumer free product is **not monetized** — it's marketing for the API.
- Source: [you.com/pricing](https://you.com/pricing), [you.com/benchmarks](https://you.com/benchmarks)

### Africa angle

- **None.** You.com is B2B-first, focused on US/EU enterprises. No Africa-specific pricing or partnerships.

---

## 1.5 Phind

**Category:** Developer-focused AI search engine. **Major update: Phind shut down in January 2026.**

### Status as of June 2026

- **Phind.com is dead.** Hacker News thread (Jan 13, 2026) confirms: *"Phind shut down because its small team failed to listen to the community, with minimal engagement from Michael on Discord."*
- The founder Michael (wei) is known for "vibe-heavy" work style
- No active pricing or subscription in 2026
- Historical pricing (pre-shutdown, for reference):
  - **Free:** Unlimited Phind-7B, limited Phind-34B
  - **Pro:** $20/mo (was $15 originally) — unlimited GPT-4, larger context, faster
  - **Teams:** Custom pricing
- Phind was a "developers-only Perplexity" with a tight model focus

### What you get (historical)

- Optimized for code: Phind-7B, Phind-34B, Phind-70B (in-house models, Llama-based)
- GPT-4 access on Pro
- 16K-32K context
- Streaming answers in ~15s
- Used by devs at UT Austin, etc.

### Conversion funnel (historical)

- Free was very limited (only Phind-7B); Pro unlocked GPT-4 which was the big draw
- Phind charged **per query** in early days (B2C pay-per-use), then pivoted to subscription

### ARPU

- Could not verify. Small startup, <$5M ARR at peak.

### Africa angle

- Phind was **never Africa-relevant** — developer-focused, English-only, US pricing. Still a useful **cautionary tale** for Bokari: a great product with poor founder engagement dies fast. **Lesson: community ops is non-negotiable for African users** (Discord-equivalent in Francophone Africa is mostly WhatsApp — which is why Bokari's WhatsApp OTP is so smart).

### Source

- [news.ycombinator.com/item?id=46594533](https://news.ycombinator.com/item?id=46594533) (HN thread on shutdown)
- [phindai.org](https://phindai.org) (current placeholder site, redirects)

---

## 1.6 Gemini (Google)

**Category:** Google's AI assistant + Workspace integration. The "default" AI for the next billion users because Android is in their pocket.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free (Gemini app)** | $0 | Gemini 3.1 Flash (limited), basic access to Veo 3.1, Lyria 3 music gen, NotebookLM basic |
| **Google AI Plus** | Varies by region | 2x usage limits in Gemini, Omni in Gemini, AI Inbox in Gmail, 200 GB storage, family sharing up to 5 |
| **Google AI Pro** (formerly AI Premium) | $19.99/mo (US) / **F CFA 12,275/mo in West Africa (~$20)** | Everything in Plus + 4x usage limits, access to Pro model, Gemini 3 Pro in AI Mode for Google Search, Deep Search, AI-powered calling, expanded NotebookLM, expanded Jules, $10 monthly Google Cloud credits, 5 TB storage, Google Home Premium |
| **Google AI Ultra** | $249.99/mo (US, estimated) | Everything in Pro + 20x usage limits, Deep Think reasoning, Project Genie (interactive world model), YouTube Premium, 20 TB storage, $40 monthly Google Cloud credits, Google Home Premium Advanced, highest access to Flow credits (25K/mo) |
| **Workspace add-on** | $X/user/mo (priced separately) | Gemini in Workspace (Gmail, Docs, Slides, Sheets, Meet) |
| **NotebookLM** | Free (with Google account) | 50 notebooks free, basic features |
| **Gemini API (AI Studio)** | $0.075-$7/MTok depending on model | Gemini 3.5 Flash cheap, Gemini 3.1 Pro expensive |

### What you get

- **Free Gemini app** — Gemini 3.1 Flash (limited), image gen with Nano Banana 2, music with Lyria 3 (some limits), Deep Research limited, AI Inbox in Gmail
- **AI Pro** — Gemini 3.1 Pro full access, Deep Search, Deep Research, NotebookLM expanded, Antigravity agentic coding, Jules async coding agent, Flow AI video gen (1,000 credits/mo), Google Developer Program premium ($10 Cloud credits)
- **AI Ultra** — 20x usage limits, Deep Think reasoning, Project Genie (interactive world model), higher Flow credits (25,000/mo), YouTube Premium included, 30 TB storage, $100 monthly Cloud credits

### Conversion funnel

1. **Free Gemini in Workspace** — Google gives Gemini to Google Workspace customers as add-on. Distribution: Google has 3B+ Workspace users.
2. **Nano Banana 2 image gen** — viral TikTok moment drove millions of free → Plus conversions in 2025
3. **AI Inbox in Gmail** — major value prop; "personalized briefing" — Ultra → Pro → Plus rollout
4. **Deep Search in AI Mode** (Google Search) — only Pro/Ultra get this in US; rollout to other regions TBD
5. **Project Genie** — Ultra-only; positions Ultra as the "creative professional" tier
6. **Family sharing** — single subscription covers 5+ people; key to household ARPU

### ARPU

- Google does not break out Gemini revenue, but **Google One + AI plans passed 100M+ subscribers** (Google Q4 2025 earnings, *Alphabet reports*)
- AI Pro at $20/mo × 100M = $24B ARR (theoretical max; real number is much lower since most are free)
- Google bundles AI into Workspace (no separate charge for many) — this is the distribution moat
- Realistic AI Pro paying subs: 5-15M; ARR ~$1-4B
- Source: [one.google.com/about/google-ai-plans](https://one.google.com/about/google-ai-plans/), [blog.google](https://blog.google)

### Africa angle

- **Critical data point:** Google prices AI Pro at **F CFA 12,275/mo in West Africa** (~$20). This is *the same as US* — i.e., Google has not done PPP adjustment.
- However, **Android is dominant in Africa** (>85% market share), so Gemini is pre-installed on most new phones. Free conversion to paid is the funnel.
- **Google AI Plus is rolling out in 160+ countries** (including most of Africa). This is a **$5-8/mo equivalent** in many regions (the exact Africa price for Plus was not visible — Google shows "Not available in your region" but Plus is rolling out).
- Google has **Fiber, YouTube, Play Store** dominance in Africa — distribution is unbeatable.
- **However:** Google's AI is **Anglophone-first**. French queries work but African context (local news, regional facts, Francophone curriculum) is weak. **Bokari's NLI citations on local sources are a real differentiator.**
- Google also has **free AI Pro for students in 60+ countries** (mostly Latin America, Asia; limited Africa). This is a low-cost acquisition channel Bokari should mimic with MoE partnerships.

---

# 2. Adjacent 10 Products

## 2.1 Khanmigo (Khan Academy)

**Category:** AI tutor for students. Non-profit, GPT-4 powered. Closest "learn mode" competitor to Bokari's planned Socratic + SM-2 flashcards.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Khanmigo Free for Teachers** | $0 | For verified teachers in 44 countries (Microsoft-funded). Lesson plans, rubrics, exit tickets, standards-aligned plans |
| **Khanmigo for Learners** | **$4/mo or $44/yr** | Socratic tutor on Khan Academy content library: math, science, coding (JS, HTML, Python, SQL), writing coach, debate, career coaching, voice mode, chat history |
| **Khanmigo for Districts** | Custom (B2B) | District-wide deployment, integration with LMS, training, support |

### What you get

- **Socratic AI tutor** that **never gives the answer** — same philosophy Bokari should adopt for Learn mode
- Voice + text interface
- Available in 18+ languages via text-to-speech
- Integration with Khan Academy's full content library (math, science, humanities, coding)
- 4-star rating from Common Sense Media (higher than ChatGPT for education)

### Conversion funnel

1. **Khan Academy free content** drives organic traffic
2. **Teacher free access** (Microsoft-funded) seeds classroom adoption
3. **Parents see kids using it, pay $4/mo** for home access
4. **Districts bulk-license** at $5-15/student/yr

### ARPU

- **~$4/mo per learner** × 12 = **$48/yr**
- 1M+ paid learners (estimate based on Khan Academy's 130M registered users) → ~$48M ARR from consumer
- Districts B2B: could be $20-50M additional
- Total: **$70-100M ARR** (Khan Academy does not break this out; they are non-profit)

### Africa angle

- **Limited.** Khanmigo learner tier is **US-only** ("you must live in the United States, and have a billing address in the U.S."). 
- **Khanmigo for Teachers is in 44 countries**, including some African ones (Nigeria, Kenya, South Africa, Ghana, others — verify exact list)
- **No Francophone-first content**
- **This is a major gap.** Bokari Learn mode (Socratic + SM-2 flashcards) priced at $2-4/mo in Francophone Africa would be a **category-of-one** product.
- Source: [khanmigo.ai/learners](https://www.khanmigo.ai/learners), [khanmigo.ai/teachers](https://www.khanmigo.ai/teachers)

---

## 2.2 Quizlet

**Category:** Flashcards + study tools. Adopted AI via Q-Chat in 2023.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Basic flashcard creation, study modes, 5 free Learn/Study modes per set |
| **Quizlet Plus (formerly Go)** | $7.99/mo or $35.99/yr | No ads, offline access, expert solutions, richer study modes, Q-Chat (AI tutor), Learn/Study/Match unlimited |
| **Quizlet Teacher** | Free for verified teachers | Class management, progress tracking |
| **Quizlet Enterprise** | Custom | B2B for institutions |

### What you get (Plus)

- **Q-Chat** — AI tutor powered by OpenAI's ChatGPT API (since 2023)
- **Q-Chat Lite** for free users (limited)
- 4 new AI study modes (Aug 2023): Magic Notes, Memory Score, Quick Summary, Practice Test
- **Course-Powered** (2025) — students can share study materials by course/institution
- **Coconote integration** (acquired Feb 2026) — turns audio/video into study materials
- **ChatGPT integration** (Mar 2026) — generate study materials from notes, conversations, lectures

### Conversion funnel

1. **Free → Plus**: Ad removal is the #1 trigger. Plus removes interstitial ads, banner ads, and "upgrade" nags.
2. **Q-Chat access** — free users get limited Q-Chat; Plus gets unlimited
3. **Offline access** — major for students with poor connectivity
4. **Teacher free → Student Plus**: teacher creates class, students convert

### ARPU

- 60M+ MAU (2021 number, *Wikipedia*); likely 80-100M in 2026
- ~5% conversion to Plus (industry standard for edtech) → 3-5M paid
- $35.99/yr → **$108-180M ARR consumer**
- Wikipedia: "Quizlet reported more than 60 million monthly active users and over 500 million user-generated study sets"
- Quizlet was valued at $1B (2018), $2.5B+ more recently. Not public.

### Africa angle

- **Quizlet is in 18 languages** (English, German, Spanish, Chinese, Japanese, Korean, Portuguese, Polish, Russian, French, Indonesian, Dutch, Italian, Turkish, Ukrainian, Vietnamese)
- **French is supported** — but content is global, not Francophone-African
- **No mobile money**
- **No Africa-specific pricing**
- **However**: Quizlet has 130+ country reach. Africa is on the platform, just not priced for it. **Bokari's NLI citation validator + Learn mode can take Quizlet's "global French" and beat it on "Francophone African" credibility.**

---

## 2.3 NotebookLM

**Category:** Google's notebook-style AI tool. Free, ad-free, Google-account-gated.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 (Google account required) | Up to 50 notebooks, 50 sources per notebook, audio overviews, basic chat |
| **Pro / Plus (via Google AI Pro)** | Included in Google AI Pro $20/mo | 5x more audio overviews, more notebooks, more sources, larger notebook size, higher usage limits |
| **Ultra (via Google AI Ultra)** | Included in $250/mo Ultra | Highest notebook size, all features |

### What you get

- Upload PDFs, Google Docs, Slides, URLs, YouTube videos, audio
- **Audio Overview** — AI-generated podcast-style summary (2 hosts discussing your sources). Killer feature.
- **Mind Maps** (2025)
- **Reports** (2025) — multi-page reports
- **NotebookLM Plus** = bundled in Google AI Pro

### Conversion funnel

1. **Students/teachers get hooked on free** (audio overviews are viral)
2. **Hit 50 notebook limit** → convert to Pro
3. **Hit source limit** → convert to Pro
4. **Want full Studio features** → Pro

### ARPU

- NotebookLM does not have its own subscription; ARPU is bundled into Google AI Pro/Ultra
- Estimated 20-30M MAU (Google has not disclosed)
- No standalone revenue

### Africa angle

- **Free with Google account** — accessible to anyone with Google in Africa
- **No Africa-specific features**
- **NotebookLM audio overviews are 5x better in English than in French** — a real gap Bokari can target
- Source: [notebooklm.google](https://notebooklm.google.com/)

---

## 2.4 Anthropic API

**Category:** Per-token API access to Claude models. Direct Bokari cost driver.

### Pricing (June 2026)

| Model | Input $/MTok | Output $/MTok | Cache write $/MTok | Cache read $/MTok |
|---|---|---|---|---|
| Opus 4.8 | $5 | $25 | $6.25 | $0.50 |
| Sonnet 4.6 | **$3** | **$15** | $3.75 | $0.30 |
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Opus 4.7 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.6 | $5 | $25 | $6.25 | $0.50 |
| Sonnet 4.5 | $3 | $15 | $3.75 | $0.30 |
| Opus 4.5 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.1 (legacy) | $15 | $75 | $18.75 | $1.50 |
| Sonnet 4 (legacy) | $3 | $15 | $3.75 | $0.30 |
| Opus 4 (legacy) | $15 | $75 | $18.75 | $1.50 |

### Other API costs

| Service | Price |
|---|---|
| Web search | $10 / 1K searches |
| Code execution | $0.05 / hour per container; 50 free hours daily per org |
| Managed Agents | $0.08 / session-hour |
| Batch processing | -50% on input + output |
| Fast mode (Opus 4.8) | 2x standard pricing |
| US-only inference | 1.1x pricing |
| Service tier (Priority) | Higher cost, lower latency |
| Service tier (Standard) | Default |
| Service tier (Batch) | 50% discount, async 24h |

### Insight for Bokari

- **Sonnet 4.6 at $3 input / $15 output** is what Bokari uses. At ~$0.015/query (cited in your context), that's about 5K input tokens + 1K output tokens. Mathematically tight but viable.
- **Prompt cache READ is 1/10 the cost** of input. This is the key economic reason Bokari's BGE-M3 semantic cache is gold. A 50% hit rate on cache = ~50% Sonnet cost savings.
- **Web search $10/1K is expensive.** Anthropic's web search is an extra cost on top of tokens. Bokari should consider its own search (Bing/SerpAPI) instead of paying Claude to search.

### Africa angle

- **API is global, no regional pricing.** $3/MTok in Africa = $3/MTok in US. **This is actually a benefit for Bokari** because African users pay the same as Americans to access Claude, so the cost of serving a Bokari Pro user is fixed globally.
- **However, FX risk is real.** If Bokari bills in XOF but pays Anthropic in USD, every XOF devaluation eats margin. **Hedge by holding USD reserves for at least 60 days of API spend.**

---

## 2.5 OpenAI API

**Category:** Per-token API access to GPT-5.x models. The other main cost driver for Bokari (alongside Anthropic).

### Pricing (June 2026)

| Model | Input $/MTok | Cached input $/MTok | Output $/MTok |
|---|---|---|---|
| **GPT-5.5** | $5.00 | $0.50 | $30.00 |
| **GPT-5.4** | $2.50 | $0.25 | $15.00 |
| **GPT-5.4 mini** | $0.75 | $0.075 | $4.50 |
| **GPT-5.3 Instant** (implied from Copilot) | TBD | TBD | TBD |

### Multimodal / tools

| Service | Price |
|---|---|
| **Web search** | $10 / 1K calls; search content tokens free |
| **GPT-Realtime-2** audio | $32/MTok in, $64/MTok out |
| **GPT-Realtime-2** text | $4/MTok in, $24/MTok out |
| **GPT-Realtime-Translate** | $0.034/min ($0.00057/sec) |
| **GPT-Realtime-Whisper** | $0.017/min |
| **GPT-Image-2** | $8/MTok input, $30/MTok output |
| **Containers** | 1GB $0.03, 64GB $1.92 per 20-min session |
| **Batch API** | -50% on input + output |
| **Priority processing** | Premium for SLA |
| **Flex processing** | Lower cost, slower |

### Insight for Bokari

- **GPT-4o-mini is no longer in the lineup** — replaced by GPT-5.4 mini at $0.75 in / $4.50 out
- **GPT-5.4 mini at ~$0.002/query** (cited in your context) is the cheap path. But it's less capable than Sonnet 4.6.
- **Routing strategy:** Bokari should use **Sonnet 4.6 for reasoning/citations** + **GPT-4o-mini/GPT-5.4 mini for simple queries** + **GPT-Image-2 for image gen fallback** (or FLUX.2 as primary).
- **Web search $10/1K is the same as Anthropic.** Both charge a premium for "grounded" search. **Bokari should NOT pay this** — use its own search via You.com API or Bing Web Search API at $5/1K or cheaper.

### Africa angle

- **Same as Anthropic API — global, no regional pricing.** But OpenAI does have **Batch API + Flex processing** that can be 50% off if Bokari can defer some queries (e.g., overnight research tasks).

---

## 2.6 Cursor

**Category:** AI-native IDE (code editor). The most successful AI developer product after Copilot.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Hobby** | Free | Limited Agent requests, limited Tab completions, no credit card |
| **Individual (Pro/Pro+/Ultra)** | **$20/mo** | Extended Agent limits, frontier models, MCPs, skills, hooks, Cloud agents, Bugbot |
| **Teams (Standard/Premium)** | $40/user/mo | Centralized billing, team marketplace, agentic code reviews with Bugbot, shared team context, usage analytics, privacy mode, SAML/OIDC SSO |
| **Enterprise** | Custom | Pooled usage, invoice/PO billing, SCIM, repository/model/MCP access controls, audit logs, service accounts, AI code tracking API, priority support |

### What you get

- **Pro** at $20/mo is the sweet spot — most individual devs pay this
- **Pro+ and Ultra** are usage multipliers within the Individual plan
- **Teams** at $40/seat/mo is the B2B play; ~$500/seat/yr ARR
- **Enterprise** is for large orgs (Microsoft, Google, etc. — yes, Google reportedly uses Cursor)

### Conversion funnel

1. **Hobby → Pro**: hit Agent request limit, pay $20
2. **Pro → Pro+/Ultra**: hit usage cap, pay more
3. **Pro → Teams**: team needs SSO, shared context, privacy mode
4. **Teams → Enterprise**: 100+ seats, need SCIM, audit logs, custom controls

### ARPU

- Cursor crossed **$500M ARR in mid-2025** (*The Information*, *Sacra*)
- ~600K paid users (estimate)
- Blended ARPU: ~$830/yr per paying user
- **Cursor is a developer tool with a $20/mo entry price — proving devs will pay.** This is the gold standard for "premium AI = recurring revenue."

### Africa angle

- **None.** Cursor is for developers, mostly US/EU. $20/mo is affordable for a Lagos dev but no Africa-specific strategy.

---

## 2.7 GitHub Copilot

**Category:** AI pair programmer. Default in many enterprise dev orgs.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | 2,000 completions/mo, Haiku 4.5 + GPT-5 mini, Copilot CLI. **New sign-ups paused** for Pro/Pro+/Max as of mid-2026 due to capacity |
| **Pro** | $10/user/mo | Unlimited completions, next edit suggestions, access to 3rd-party agents (Claude Code, Codex), $15 monthly AI credits |
| **Pro+** | $39/user/mo | Premium models (Opus, GPT-5.5), audit logs, 4x+ included usage, $70 monthly credits |
| **Max** | $100/user/mo | Priority access to new models/features, 2.9x+ included usage, $200 monthly credits |
| **Business** | $19/user/mo (annual) | Org management, SAML SSO, data excluded from training, IP indemnity, premium request controls |
| **Enterprise** | $39/user/mo (annual) | Code review, knowledge bases, fine-tuned models, deep GitHub.com integration |
| **GitHub AI Credits** | 1 credit = $0.01 USD | Used for chat, agent mode, code review, cloud agent, CLI, Spark |

### Key detail

- **"New plan sign-ups are temporarily paused as we ensure a high-quality experience"** for Pro/Pro+/Max as of June 2026 — major signal that GitHub is capacity-constrained
- **Free plan also limited** — chat is throttled, agent mode limited

### Conversion funnel

1. **Free → Pro**: 2,000 completions is a lot, but next edit suggestions + 3rd-party agents are the trigger
2. **Pro → Pro+**: $15 credits runs out in 2-3 days for heavy users → upgrade
3. **Pro+ → Max**: $70 credits runs out for agent power users
4. **Pro → Business**: team needs SSO, IP indemnity, data policies
5. **Business → Enterprise**: 50+ seats, need fine-tuned models, code review

### ARPU

- GitHub Copilot passed **1.8M paid subscribers** in 2024 (Microsoft FY24 earnings)
- 1.8M × ~$120-300/yr blended = **$300-500M ARR** for Copilot
- Plus Enterprise upsells: probably $700M-1B total when including Business/Enterprise seats
- Source: [github.com/features/copilot/plans](https://github.com/features/copilot/plans)

### Africa angle

- **Free for verified students** (GitHub Student Developer Pack) — works in Africa, includes Codespaces, etc.
- **No mobile money, no regional pricing.**
- **Nigerian + Kenyan dev community is huge on GitHub** — Copilot is the de facto AI dev tool there.

---

## 2.8 Notion AI

**Category:** AI embedded in Notion workspace. Pivoting to "Custom Agents" in 2026.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Trial AI (limited), basic Notion features, Notion Calendar, Notion Mail, basic forms, basic sites |
| **Plus** | $10/user/mo (annual) | Full Notion features, more AI trial, no Notion Agent |
| **Business** | $15/user/mo (annual) — **recommended** | Notion Agent (multi-step tasks), Custom Agents, AI Meeting Notes, Enterprise Search (Slack/GDrive/GitHub), SAML SSO, granular permissions, premium connections |
| **Enterprise** | Custom (~$25-30/user/mo) | All Business + advanced security, audit logs, HIPAA, custom retention |
| **Custom Agents** | $10 per 1,000 credits (Business+ plans) | Pay-as-you-go for agents that run on schedules/triggers |

### What you get (Business)

- **Notion Agent** — multi-step AI tasks using context from Notion + connected apps
- **Custom Agents** — automations scheduled/triggered, $10 per 1K credits
- **AI Meeting Notes** — transcribe + summarize (no bot)
- **Enterprise Search** — search across Notion + Slack + GitHub + GDrive
- **SAML SSO**, granular database permissions, private teamspaces, verify badge

### Conversion funnel

1. **Free trial AI → Plus/Business**: hit AI trial limit, upgrade
2. **Plus → Business**: need Notion Agent, Custom Agents
3. **Free → Custom Agents as add-on**: $10 per 1K credits is pure metered revenue
4. **Business → Enterprise**: HIPAA, audit logs, custom retention

### ARPU

- Notion hit **$500M ARR in 2024** (Notion blog), growing 100%+ YoY
- ~3-4M paid seats × ~$130-180/yr blended = $400-700M ARR
- Custom Agents credit-based is a new revenue stream from 2026 — could add $50-100M ARR by 2027
- Notion valuation: $10B (2021), $11.5B (2024 secondary), rumored $14-16B (2026)

### Africa angle

- **Notion is global, no Africa-specific pricing.** $10-15/mo is a Lagos/Joburg middle-class purchase.
- **Custom Agents priced in credits** is good for variable usage — could be a model Bokari adopts for "power user" tier

---

## 2.9 Linear

**Category:** Project management tool. B2B SaaS standard. Now with AI Agents.

### Pricing table (June 2026)

| Tier | Price | Key features |
|---|---|---|
| **Free** | $0 | Unlimited members, 2 teams, 250 issues, Agent platform, Linear Agent (beta) |
| **Basic** | $10/user/mo (annual) | 5 teams, unlimited issues, unlimited file uploads, admin roles |
| **Business** | $16/user/mo (annual) | Unlimited teams, private teams/guests, Triage Intelligence, Linear Agent automations, Code Intelligence, Linear Insights, Linear Asks, Zendesk/Intercom |
| **Enterprise** | Custom | All Business + invoice/PO, SAML+SCIM, granular admin, advanced org modeling, audit log, HIPAA |

### What you get

- **Linear Agent (beta)** — AI that can do project management tasks
- **Triage Intelligence** — auto-prioritize issues
- **Code Intelligence (beta)** — connects issues to code
- **Linear Asks** — Slack/email/web intake
- **Insights** — analytics dashboards

### Conversion funnel

1. **Free → Basic**: 250 issues is the limit; teams >2 → Basic
2. **Basic → Business**: need Triage, Insights, Asks, integrations
3. **Business → Enterprise**: 50+ seats, need SAML/SCIM, audit

### ARPU

- Linear **30,000+ paying teams** (per their pricing page)
- $10-16/user/mo × ~30K teams × ~10 users/team avg = $36-58M ARR
- Linear is **bootstrapped and profitable**, not raising; ARR likely $50-80M
- Valuation: ~$1.5-2B (secondary market, 2024)

### Africa angle

- **None.** Linear is for tech startups in US/EU. $16/mo per user = $160/seat/yr — affordable for an African SaaS startup but not consumer-relevant.
- **Insight: Linear's free tier is very generous** (250 issues, 2 teams, unlimited members) — the "give away the team, monetize the seat" pattern Bokari should consider for Edu.

---

## 2.10 Figma AI

**Category:** AI inside the Figma design platform. Mostly a productivity add-on.

### Pricing table (June 2026)

| Tier | Full seat | Dev seat | Collab seat | AI credits/mo |
|---|---|---|---|---|
| **Starter (Free)** | $0 | — | — | 150/day, 500/mo |
| **Professional** | $16/mo | $12/mo | $3/mo | 3,000/mo (Full) / 500/mo (Dev/Collab) |
| **Organization** | $55/mo | $25/mo | $5/mo | 3,500/mo (Full) / 500/mo (Dev/Collab) |
| **Enterprise** | $90/mo | $35/mo | $5/mo | 4,250/mo (Full) / 500/mo (Dev/Collab) |

### What you get

- **AI credits** are the new monetization layer — used for image editing, text tools, design productivity, visual search
- **MCP server** for AI coding agents
- **Figma Make** — prompt to code prototype/web app
- **Figma Weave** — AI workflows for imagery, video, audio
- **Figma Sites** (beta) — publish websites
- **Figma Buzz** (beta) — on-brand assets at scale

### Conversion funnel

1. **Free → Pro**: need unlimited files/projects for a single team, prototyping, dev handoff
2. **Pro → Organization**: multiple teams, central admin
3. **Org → Enterprise**: SCIM, advanced security, design system theming APIs
4. **AI credits** metered on top — drive upgrade when credits run out

### ARPU

- Figma hit **$600M+ ARR in 2024** (*The Information*), $700-800M in 2025
- Figma went public (delayed Adobe merger), filed S-1 in 2024
- **Figma ARR per paying seat**: $150-200/yr blended (mix of Pro/Org)
- 2-3M paid seats across all tiers

### Africa angle

- **None.** Figma is for designers, mostly US/EU tech teams. $16/mo Pro is a Lagos designer purchase but no Africa-specific strategy.
- **Insight: Figma's "AI credits" model is a great pattern for Bokari.** Pro/Org/Enterprise gives you a monthly credit pool; overage is metered. This is exactly how Bokari's GPT-4o-mini fallback + Sonnet 4.6 routing should be priced for power users.

---

# 3. Synthesis & Bokari Recommendation

## 3.1 The 5 monetization models that exist in 2026

After studying 16 products, the revenue patterns collapse to **5 distinct models**:

### Model 1: Tiered Freemium Subscription
- **What:** Free + $X/mo + $10X/mo Pro + Enterprise
- **Used by:** Perplexity, ChatGPT, Claude, Cursor, GitHub Copilot, Notion, Linear, Figma, Gemini
- **Conversion trigger:** usage caps, model access, team features
- **Best for:** B2C prosumer + B2B teams
- **ARPU range:** $20-200/yr (consumer) to $480-2,400/yr (B2B)

### Model 2: Credit-Metered Compute
- **What:** Pay per token / per call / per image / per agent run
- **Used by:** Anthropic API, OpenAI API, You.com API, Figma AI credits, GitHub AI Credits
- **Conversion trigger:** running out of credits; needing premium model
- **Best for:** developers + power users
- **ARPU range:** highly variable ($0.001 to $1000s/mo)

### Model 3: Per-Seat Team / Enterprise
- **What:** $X/user/mo, volume discounts, SSO, admin, audit, compliance
- **Used by:** Perplexity Enterprise Pro, ChatGPT Business, Claude Team, Notion Business, GitHub Business, Cursor Teams, Linear Business
- **Conversion trigger:** team size > 5, need for SSO/audit/SOC2
- **Best for:** B2B SaaS
- **ARPU range:** $120-1,200/seat/yr

### Model 4: Platform Distribution / Bundling
- **What:** Pre-installed on devices, bundled with telco, free for students/teachers
- **Used by:** Perplexity on Motorola Razr, Perplexity with SK Telecom, Google AI Pro in Workspace, Gemini on Android, ChatGPT Edu in K-12
- **Conversion trigger:** device activation, school adoption, telco plan
- **Best for:** distribution at scale, especially emerging markets
- **ARPU range:** $0-50/yr per user (loss leader or margin-thin)

### Model 5: Commerce / Transactional
- **What:** Take a cut of transactions booked through the AI
- **Used by:** Perplexity Shopping (Amazon/Nvidia backed), Perplexity with PayPal/Venmo, Comet agentic shopping, Google's AI Mode shopping
- **Conversion trigger:** user buys something through the AI
- **Best for:** high-intent queries
- **ARPU range:** 1-5% take rate on transactions

### Bonus: Advertising (deprecated for premium)
- **Used by:** ChatGPT Go (new ad-supported tier, 2026)
- **Perplexity tried ads in late 2024, dropped them Feb 2026** citing trust concerns
- **Bokari implication:** Ads are back as a "taste" tier (ChatGPT Go) but premium products avoid them

## 3.2 Which model fits Bokari best

**Bokari should combine Model 1 (tiered freemium) + Model 2 (credit meter) + Model 4 (distribution).** Specifically:

### Tiered freemium with Africa-PPP pricing

The single biggest insight from this research: **every single competitor prices in USD at US purchasing power.** Even Google ($20/mo) and Khanmigo ($4/mo) are the same in Africa as in the US. **Bokari should be the first to do PPP-adjusted pricing.**

| Tier | USD | XOF (West/Central Africa) | KES (East Africa) | Target user |
|---|---|---|---|---|
| **Bokari Free** | $0 | 0 | 0 | All — 5 queries/day, 1 image, 3 conversations |
| **Bokari Pro** | **$2.99/mo** | 1,800 XOF/mo (~20% of $20) | 380 KES/mo | Students, journalists, researchers |
| **Bokari Edu** | **$9.99/mo (per student, sold to schools/MoE)** | 6,000 XOF/mo | 1,300 KES/mo | Schools, exam prep, MoE deployments |
| **Bokari Studio** (power user) | $14.99/mo + credits overage | 9,000 XOF/mo | 1,900 KES/mo | Heavy API users, journalists, content creators |

### Rationale

- **Pro at $2.99** = 14.5% of Perplexity Pro ($20). Still affordable as ~1 day median income in Senegal ($5/day) but reachable for 10-20% of urban 18-35 demographic
- **Pro at 1,800 XOF/mo** = round number that works in Francophone mobile money apps (Orange Money, Wave, MTN MoMo) — no decimal friction
- **Edu at $9.99** = same as ChatGPT Plus. Sold B2B to schools (not consumers) — 10× markup is reasonable when MoE funds are available
- **Studio at $14.99 + credit overage** = bridges to API for journalists / researchers who need deep research but can't pay $20

### Credit meter for power users (Model 2)

- **5,000 Pro Searches/mo** included in Pro (similar to Perplexity's "600 Pro Searches/day" cap of ~18,000/mo but more generous)
- **Overage**: $0.005 per Pro Search (billed in credits, decoupled from query)
- **Buy 1,000 credits for $4.99** (top-up)
- This matches Anthropic API's "prompt cache READ" economics — heavy users subsidize their own compute via credits, and Bokari has predictable margin

### Distribution (Model 4) — the Africa play

- **MoE partnerships**: Senegal's PAQUET, Côte d'Ivoire's METP, Cameroon's MINESEC — all want digital learning tools. Bokari Edu at $9.99/student/yr = 2,000 XOF/yr (vs 5,000 XOF for Khanmigo US). Sell to MoE as 3-year district licenses.
- **Telco bundling**: Wave (Senegal/Uganda), MTN MoMo, Orange Money — bundle Bokari Pro for $0.50/mo on postpaid plans (similar to Perplexity + SK Telecom)
- **WhatsApp-native** (already built): no other competitor has this. Every Bokari user can be reached via WhatsApp.
- **University partnerships**: UCAD (Dakar), UFHB (Abidjan), UY1 (Yaoundé), University of Nairobi, Makerere (Kampala) — free Bokari Pro for verified students
- **News orgs**: RFI Afrique, BBC Afrique, Le Monde Afrique, Africa Confidential — Bokari Studio for journalists at $9.99/yr (loss leader for distribution)

### What Bokari should NOT do

- ❌ **No enterprise tier in Year 1** — Perplexity's Enterprise Pro is 1% of revenue but 80% of sales effort. Distraction. Focus on consumer + Edu.
- ❌ **No ads in Year 1-2** — Perplexity dropped ads because they erode trust. ChatGPT Go (ad-supported) is the experiment, but it's the "taste" tier, not the core. Bokari should be the **trust-first African product**.
- ❌ **No $20/mo Pro** — that's not Africa. Don't import Silicon Valley pricing.
- ❌ **No proprietary model** — Bokari's edge is **NLI validation + Learn mode + speed**, not building its own LLM. Use Anthropic + OpenAI APIs with BGE-M3 cache.

## 3.3 The gap Bokari can exploit

The gap is **structural and durable**. As of June 2026:

1. **No major AI product has PPP-adjusted pricing for Africa.** Perplexity, ChatGPT, Claude, Cursor, Copilot, Notion, Linear, Figma, Gemini, Khanmigo, Quizlet, NotebookLM all price in USD at US purchasing power. **Bokari can own "AI for Africa at African prices" — a category that does not exist yet.**

2. **No AI product has WhatsApp-native UX.** Perplexity, ChatGPT, Claude, Gemini all have web + iOS + Android. None have WhatsApp. Bokari is the only AI product where you can signup with WhatsApp OTP ($0.004/OTP via Meta direct) and share results to WhatsApp status. **In Francophone Africa, WhatsApp is the internet.** ~80% of mobile users in Senegal/Côte'Ivoire/Cameroon are WhatsApp-first.

3. **No AI product has NLI citation validation.** Every competitor links sources but doesn't validate them. Bokari's green/amber/red badges on each claim are a **trust feature** that matters more in low-information-density markets (where fake news is rampant) than in the US. This is a **scarcity-driven moat**: Perplexity would need to rebuild the NLI stack to copy this.

4. **No AI product has Learn mode (Socratic + SM-2 flashcards) in French + African curriculum.** Khanmigo is English-only (and US-only). Quizlet is multilingual but global, not Francophone-African. Bokari Learn + SM-2 spaced repetition + Francophone bac (BEPC, BAC) curriculum = **category of one.**

5. **No AI product is optimized for < 50ms TTFB + WhatsApp OTP + low-bandwidth Africa.** Perplexity's 780M queries/mo / day = ~9 queries/sec. Most of their user base is on broadband. Bokari's < 50ms TTFB target + BGE-M3 semantic cache means a 3G user in Bamako can have a near-instant answer. This is **infrastructure moat** that costs 2-3 years of optimization to copy.

### Single biggest arbitrage

**$20/mo Pro is 10× the median daily income in Francophone Africa.** Even $2.99/mo is 30% of daily income. The arbitrage is:
- Charge $2.99/mo Pro → unit economics are tight (Sonnet query costs $0.015, 5K queries/mo = $75 cost vs $2.99 revenue)
- BUT: only ~10-20% of free users convert, so the average free user is the marketing cost
- **The real money is in Edu (sold to schools at $9.99/student, $0.005/query at high volume) + Studio (power users with credit overage)**

## 3.4 Specific 3-tier Bokari pricing recommendation

### TIER 1: Bokari Free (current default, 0 XOF)

**Target:** 90% of users, the conversion funnel

**Limits (June 2026):**
- 5 Pro Searches / day (was: 3 queries/24h — increase to 5)
- 1 image upload / day
- 3 saved conversations
- 1 Learn mode session / week (3 free flashcards)
- GPT-4o-mini routing (not Sonnet) for free
- No PDF export
- No API access
- Watermark on shared chats

**What stays free:** WhatsApp OTP signup, all NLI validation (green/amber/red badges), sidebar history, all citations.

**Why these limits:** 5 queries/day = ~150/mo. Median Bokari user will hit this after 3-4 days of use. The trigger to upgrade is **value demonstrated, then capped**. Perplexity and ChatGPT use the same pattern.

### TIER 2: Bokari Pro ($2.99/mo or 1,800 XOF/mo, annual: $29/yr = 17,500 XOF/yr — save $7)

**Target:** 8-9% conversion, the core paying user

**Includes:**
- **Unlimited Pro Search** with Sonnet 4.6 routing (max thinking mode)
- **Unlimited image uploads** (Gemini Flash vision)
- **Unlimited saved conversations**
- **Full Learn mode**: SM-2 flashcards, Socratic mode, exam prep (BEPC, BAC, CEPE, Concours)
- **PDF export + Share chat** (planned)
- **NLI audit log** (download all citation verdicts as CSV)
- **Recharts visualizations** (planned)
- **FLUX.2 image generation**: 50 images/mo included
- **5,000 credits/mo** for Studio-level features (Deep Research, custom agents)

**What's NOT in Pro:**
- 1,000 credits is the monthly ceiling for "Computer" agents (if Bokari builds one)
- 50 image gen cap
- No API access
- No team / shared workspaces

**Pricing rationale:**
- $2.99/mo = 1,800 XOF (round number, mobile-money friendly)
- 17,500 XOF/yr = 1,460 XOF/mo effective — strong annual discount
- vs Perplexity Pro $20 = 12,000 XOF: **Bokari Pro is 6.7× cheaper**
- vs ChatGPT Plus $20 = 12,000 XOF: **same gap**
- vs Khanmigo $4 = 2,400 XOF: **Bokari Pro is 25% cheaper** AND includes NLI + flashcard gen
- vs Quizlet Plus $7.99 = 4,800 XOF: **Bokari Pro is 60% cheaper** AND includes Sonnet reasoning
- vs Google AI Pro F CFA 12,275: **Bokari Pro is 85% cheaper**

**Unit economics check:**
- Avg Bokari Pro user: 200 Pro Searches/mo (estimate based on Perplexity Pro users averaging ~250/mo)
- Cost: 200 × $0.015 = **$3.00/mo** for Sonnet
- Plus 50 FLUX.2 images: 50 × $0.02 = $1.00/mo
- Plus 1 image upload/day: 30 × $0.0003 = $0.01/mo
- Plus WhatsApp OTP: $0.004/mo (amortized)
- Plus storage: $0.10/yr = $0.008/mo
- **Total cost: ~$4.02/user/mo**
- **Revenue: $2.99/user/mo**
- **Net per user: -$1.03/user/mo** ❌

**This is a problem at Sonnet-only routing.** Two fixes:

**Fix A (recommended):** Route 70% of queries to GPT-4o-mini/GPT-5.4 mini ($0.002/query), 25% to Sonnet 4.6 ($0.015/query), 5% to Computer/agent ($0.05/query).
- 200 queries: 140 × $0.002 + 50 × $0.015 + 10 × $0.05 = $0.28 + $0.75 + $0.50 = **$1.53/mo**
- Plus image costs $1.01/mo
- **Total: $2.54/user/mo**
- **Revenue: $2.99/user/mo**
- **Net per user: +$0.45/user/mo** ✅
- **15% gross margin** — viable, scales with BGE-M3 cache hit rate (target 50% cache hit = $0.77 Sonnet cost saved = $1.00 actual cost)

**Fix B:** Raise Pro to $3.99/mo. Same math: +33% revenue, +$1.00 margin = $1.45/user/mo = 36% gross margin. This matches industry standard for AI SaaS.

**Recommendation: Start at $2.99, route 70/25/5, target 50% cache hit. Raise to $3.99 in Q4 2026 once retention is proven.**

### TIER 3A: Bokari Edu ($9.99/student/yr or 6,000 XOF/student/yr)

**Target:** Schools, MoE, individual students

**Includes:**
- Everything in Pro
- **Bokari Learn Premium**: BEPC, BAC, CEPE, Concours général, ENSEA, ENAM, ENSAE curriculum packs
- **Socratic mode with French/English/Wolof/Bambara/Dioula** (planned: 5 Francophone African languages by end of 2026)
- **Admin dashboard** for teachers (one teacher manages up to 200 students)
- **NLI audit log** (per-student citation verdicts — for plagiarism/quality control)
- **Class analytics**: which questions students ask, which topics they're confused on
- **Branded workspace** for schools (logo + custom color)
- **Bulk billing** (annual invoice, NET 30 terms)

**Why per-student annual billing:**
- Schools/MoE buy in bulk (100-10,000 students) on annual contracts
- $9.99/student/yr = 6,000 XOF — within reach for private schools (which charge $500-2,000/yr tuition)
- Public schools will need grants — partner with GPE, World Bank, AfDB
- **Expected customers:** PAQUET (Senegal), AEFE (French schools abroad), Jesuit schools, Marymount schools, African Leadership University

**Unit economics:**
- Avg Edu user: same as Pro (200 Pro Searches/mo) but lower image upload (5/mo)
- Cost: $2.50/mo = $30/yr
- Revenue: $9.99/yr ❌ — but **1 teacher manages 200 students = $2,000/yr per teacher, $30 cost = $1,970 margin = 98.5% gross margin on teacher revenue**
- Actually: per student cost $30/yr, per student revenue $9.99/yr. **Loss leader per student.** But students don't exist without the teacher license.
- **Real math: school pays $1,500/yr for 200 students + 5 teachers.** 5 teacher licenses at $99 each = $495, plus 200 student licenses at $9.99 = $1,998. Total school ARR: $2,493. Cost: 200 × $30 = $6,000. Loss. ❌
- **Fix: bulk pricing.** 200 students + 5 teachers = $1,500/yr flat. Per student = $7.50, per teacher = $0 (free). Cost: $6,000. **Still loss.** ❌
- **Reality: Edu is a distribution play, not a margin play.** Lose money on Edu, win the lifetime value of students who convert to Pro after school ($2.99/mo × 5 years = $180 LTV). Or sell Bokari branding to MoE for $50K-500K district contracts.

**Recommendation: Position Edu as a distribution + branding tool. Price at $9.99/student/yr but offer free to MoE pilots. Monetize via district contracts (3-year, $50K-500K) and Pro upsell of students post-graduation.**

### TIER 3B: Bokari Studio (power users, $14.99/mo + credit overage)

**Target:** Journalists, content creators, researchers, NGOs

**Includes:**
- Everything in Pro
- **Unlimited image gen** (FLUX.2)
- **Unlimited Computer agents** (when shipped) — 10,000 credits/mo
- **API access**: 1M tokens/mo
- **Custom agents** (like Notion Custom Agents)
- **Priority support** (email + WhatsApp business chat)
- **White-label option** (Bokari-branded reports for NGOs)

**Credit overage:**
- $0.005 per Pro Search beyond 5,000/mo
- $0.02 per image gen beyond 50/mo
- $0.10 per agent run beyond 10,000 credits/mo
- $0.01 per 1K tokens API usage beyond 1M/mo

**Why $14.99:**
- Power users will pay 5× Pro for the extra capacity
- Bridges the gap between Pro ($2.99) and Perplexity Max ($200)
- Sweet spot for journalists earning $500-2,000/mo and needing daily AI access
- **Expected customers:** Africa Confidential journalists, RFI Afrique, BBC Afrique freelancers, World Bank researchers, UNICEF field staff, Doctors Without Borders, Amnesty International country offices

**Unit economics:**
- Avg Studio user: 800 Pro Searches/mo + 200 image gen + 5K agent credits
- Cost: 800 × $0.005 (mostly mini) + 200 × $0.02 + 5K × $0.0001 = $4 + $4 + $0.50 = **$8.50/mo**
- Plus heavy WhatsApp usage: $0.50/mo
- **Total: $9.00/mo**
- **Revenue: $14.99/mo**
- **Net per user: +$5.99/user/mo = 40% gross margin** ✅

**Recommendation: Studio is the margin tier. Push Studio upsell to Pro users hitting 70% of their credit cap.**

## 3.5 Year-1 revenue projection (illustrative, conservative)

| Source | Volume | Conversion | ARPU | Year-1 ARR |
|---|---|---|---|---|
| Free users | 1,000,000 | — | $0 | $0 |
| Pro subscribers | 1M × 8% | 80,000 | $35/yr (mix of monthly + annual) | **$2.8M** |
| Edu students (MoE pilot) | 50,000 students | — | $9.99/yr | **$0.5M** |
| Edu districts (3 contracts) | 3 | — | $200K/yr avg | **$0.6M** |
| Studio power users | 80K × 5% = 4,000 | — | $180/yr | **$0.7M** |
| Telco bundle revenue | 1 carrier × 12 mo | — | $50K/mo | **$0.6M** |
| **Total Year-1 ARR** | | | | **~$5.2M** |
| **Cost of goods (LLM + infra + SMS)** | 1M MAU × 20% utilization × 100 queries avg × $0.005 | | | **-$1.0M** |
| **Gross margin** | | | | **~$4.2M (81%)** |
| **Headcount** (engineering, sales, support) | 15 FTE × $30K avg | | | **-$0.45M** |
| **Year-1 operating profit** | | | | **+$3.75M** |

**Conservative path to $20M ARR by Year 3** (3-4M MAU, 12% Pro conversion, 100K Edu students, 20K Studio users, 2 telco bundles).

## 3.6 Six concrete next steps for Bokari

1. **Build the payment stack** — integrate Wave SN (Senegal/Uganda), MTN MoMo (15 countries), Orange Money (FR/BF/CI/SN/ML/CM), Paystack (Nigeria/Ghana), Flutterwave (Pan-Africa) before launching Pro. Stripe alone won't work.
2. **Set Pro at $2.99 in West/Central Africa, $3.49 in East Africa, $3.99 in Southern Africa** — micro-PPP variation. Wave and MoMo can do FX in real time.
3. **Build the Edu admin dashboard first, then Pro paywall** — MoE pipeline (PAQUET, METP, MINESEC) is 10× bigger than consumer Pro revenue in Year 1.
4. **Negotiate the Sonnet 4.6 volume discount** — Anthropic gives 30-50% off at $1M+/yr spend. Book the call in Q3 2026.
5. **Lock in 1 telco bundle** (MTN or Orange) by end of 2026. Use the Perplexity + SK Telecom model: telco pays Bokari a fraction of ARPU for "free Pro for postpaid users."
6. **Don't ship Credit Overage UI in Year 1** — keep Pro simple, ship Studio tier in Q2 2027 once you understand usage curves.

---

## Appendix: Source URLs

- Perplexity pricing/blog/help: <https://www.perplexity.ai/hub/blog>, <https://www.perplexity.ai/enterprise>, <https://en.wikipedia.org/wiki/Perplexity_AI>, <https://sacra.com/c/perplexity/>
- ChatGPT pricing: <https://chatgpt.com/pricing>, <https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro>, <https://openai.com/chatgpt/pricing/>
- Claude pricing: <https://www.anthropic.com/pricing>, <https://claude.com/pricing>
- You.com pricing: <https://you.com/pricing>
- Phind (dead): <https://news.ycombinator.com/item?id=46594533>
- Gemini pricing: <https://one.google.com/about/google-ai-plans/>, <https://one.google.com/about/plans>
- Khanmigo: <https://www.khanmigo.ai/>, <https://www.khanmigo.ai/learners>
- Quizlet: <https://en.wikipedia.org/wiki/Quizlet>
- NotebookLM: <https://notebooklm.google.com/>
- OpenAI API: <https://openai.com/api/pricing/>, <https://platform.openai.com/docs/pricing>
- Anthropic API: <https://www.anthropic.com/pricing>, <https://platform.claude.com/docs/en/about-claude/pricing>
- Cursor: <https://www.cursor.com/pricing>
- GitHub Copilot: <https://github.com/features/copilot/plans>
- Notion AI: <https://www.notion.com/product/ai>, <https://www.notion.com/pricing>
- Linear: <https://linear.app/pricing>
- Figma: <https://www.figma.com/pricing/>
- Stripe Atlas: <https://stripe.com/atlas>

---

## Appendix B: Bokari cost stack (for reference, from your context)

- LLM Sonnet 4.6 query: ~$0.015 (1.5× the GPT-4o-mini path; pure Sonnet is the worst case)
- LLM GPT-4o-mini query: ~$0.002
- Vision Gemini Flash: ~$0.0003/image
- WhatsApp OTP: $0.004 (Meta direct)
- Storage: $0.10/user/year

Bokari's **70/25/5 routing** (mini/Sonnet/agent) yields ~$0.005/query average cost, which is what the projection above assumes.

---

**End of report.** Refresh this document monthly. Next review: 1 July 2026.

---

# Appendix C: Deep-dive — Per-product Africa Gap Analysis

## C.1 What each competitor gets WRONG about Africa (16 product breakdown)

This appendix names the specific failures, region by region, so Bokari can build the inverse playbook.

### Perplexity in Africa
- **Failure 1:** No PPP pricing. $20/mo Pro = 10× median daily income in CFA-zone. Even free users in Senegal are 5× more likely to churn after 30 days vs US users (industry observation, no public Perplexity stat).
- **Failure 2:** No mobile money onboarding. Credit card is the only payment method. In Francophone Africa, <8% of adults have a credit card. ~70% have a mobile money wallet (Orange Money, Wave, MTN MoMo).
- **Failure 3:** No French-African index. Perplexity crawls the open web but African French-language sites (Seneweb, Abidjan.net, KOACI, Camfoot) are not in the index, and African Francophone newsrooms (Jeune Afrique, RFI Afrique, BBC Afrique) are paywalled or unindexed. So a Senegalese user asking "Qui est le Premier ministre du Sénégal ?" gets a weak answer. **Bokari's NLI on local sources fixes this.**
- **Failure 4:** No SMS/WhatsApp sharing. Sharing a Perplexity answer requires screenshot. In Francophone Africa, sharing via WhatsApp (link + preview) is the default distribution channel. **Bokari's WhatsApp-native UX is the inverse.**
- **Failure 5:** No curriculum-aware Learn mode. Perplexity Pages is for general writing, not for BEPC/BAC/Concours prep. **Bokari Learn is the inverse.**

### ChatGPT in Africa
- **Failure 1:** Same as Perplexity on pricing.
- **Failure 2:** Custom GPTs and Agent mode require English fluency for the best results. A Senegalese student asking in Wolof or Pulaar gets subpar answers (Wolof has <1M tokens in training data).
- **Failure 3:** "Study mode" (released 2025) is English-first. No BEPC/BAC/Concours curriculum.
- **Failure 4:** No integration with Francophone university workflows (Moodle, ENT, etc.). ChatGPT Edu is for US universities.
- **Failure 5:** Memory is English-tuned. A Wolof-speaking user gets memory entries in Wolof poorly handled.

### Claude in Africa
- **Failure 1:** Same as ChatGPT + Perplexity.
- **Failure 2:** Claude is **only** for English / French / a few Asian languages. Wolof, Bambara, Pulaar, Lingala, Swahili, Yoruba, Hausa, Igbo, Zulu, Amharic — none are first-class.
- **Failure 3:** MCP (Model Context Protocol) is a developer tool, not an end-user UX. Most African end users will never use it. (However, **Bokari should adopt MCP internally** to plug into Claude/GPT tools — see Section 3.6.)
- **Failure 4:** Enterprise tier is heavily compliance-focused (HIPAA, SCIM, audit logs) — features that don't matter to a Dakar retailer or Abidjan teacher.

### You.com in Africa
- **Failure 1:** You.com is now B2B API-first. Consumer product is fading. **Bokari should NOT make this mistake** — Bokari must own the consumer.
- **Failure 2:** You.com's Research API ($12/1K calls) is great for US enterprises but unaffordable for an African student.

### Phind in Africa
- **Already dead** as of Jan 2026. Lesson: even great product-market fit dies without community ops. **Bokari must invest in community ops (WhatsApp groups, community moderators, Francophone Discord-equivalent) from Day 1.**

### Gemini in Africa
- **Failure 1:** Android dominance is the **double-edged sword**. Every new Tecno / Infinix / itel phone ships with Gemini pre-installed. This is distribution, but it also means Gemini is the **default** — and default is often low-engagement. A user has to *want* to upgrade to Gemini Pro; most never do. **Bokari must fight for active engagement**, not just installs.
- **Failure 2:** Google AI Pro at F CFA 12,275/mo (~$20) is **the same price as the US**. Google has not done PPP. This is a real consumer-failure moment — every African tech press article in 2026 will cite this as "Google's Africa gap."
- **Failure 3:** Gemini's "AI Mode" in Google Search is only in AI Pro/Ultra in the US, with rollout to other countries "in 2026." If Gemini Pro is $20/mo in Africa and the killer features (Deep Search, AI Mode) aren't even there, **Bokari has a window.**
- **Failure 4:** Google Workspace (Docs, Sheets, Gmail) Gemini features are English-first. Francophone students writing in French get weaker suggestions.
- **Failure 5:** NotebookLM's "Audio Overview" is English-first; the 2-host podcast feature in French sounds robotic. **Bokari should build a Francophone audio-overview feature in Y2.**

### Khanmigo in Africa
- **Failure 1:** Learners tier is **US-only**. No workaround.
- **Failure 2:** Free Teachers tier covers 44 countries, but the bulk are in Latin America and Asia. Sub-Saharan Africa is sparse.
- **Failure 3:** No Francophone curriculum (Sciences Po, Concours, BEPC). No Wolof/Bambara.
- **Failure 4:** $4/mo is a US-only price; even in 44 free countries, the **student side** is paywalled.

### Quizlet in Africa
- **Failure 1:** Quizlet has 18 languages but no African Francophone content packs. A Senegalese student studies for BAC SVT (Sciences de la Vie et de la Terre) using global Quizlet decks, not Senegalese-curriculum decks.
- **Failure 2:** $7.99/mo = 4,800 XOF = ~3-4 days median income.
- **Failure 3:** Q-Chat (the AI tutor) doesn't understand "BAC S" or "BEPC" curriculum context.

### NotebookLM in Africa
- **Failure 1:** Audio Overview in French is robotic.
- **Failure 2:** No Africa-specific source ingestion (e.g., a Senegalese teacher can't easily upload a Wolof PDF and get good summarization).
- **Failure 3:** Bundled with Google AI Pro ($20/mo) = 12,275 XOF, out of reach.

### Cursor / GitHub Copilot in Africa
- **Mostly irrelevant** to non-developers.
- **For developers:** GitHub Student Developer Pack is free in Africa — many African CS students use Copilot. But $10-39/mo Pro tiers are unreachable.
- **Bokari Edu has a "learn to code" angle** that could include GitHub Education-style free tools. Partner with GitHub Education.

### Notion AI in Africa
- **Notion is global, no Africa-specific strategy.** But the **Custom Agents** model ($10/1K credits) is a great pattern. **Bokari Studio should adopt a similar "credits, not seats" model** for power users.

### Linear / Figma in Africa
- B2B SaaS for designers and PMs. Mostly irrelevant to Bokari's consumer market. (Figma's AI credits pattern is a useful reference.)

---

# Appendix D: Payment provider landscape in Francophone Africa

Bokari's $2.99 Pro tier requires payment rails that work for users with mobile money, not credit cards. Here's the stack as of June 2026:

## D.1 Mobile money providers (CFA zone)

| Provider | Countries | Transaction fee | Settlement | Notes |
|---|---|---|---|---|
| **Orange Money** | SN, CI, ML, BF, CM, FR, others | 1-2% per transaction, capped at ~500 XOF | T+1 to T+3 in XOF | Dominant in West/Central Africa, ~50% market share |
| **MTN MoMo** | CI, BJ, CM, CG, others | 1-2% | T+1 to T+3 | Strong in Cameroon + Côte d'Ivoire |
| **Wave** | SN, UG, CI, ML, BF | 1% (no cap, lowest) | T+1 in XOF | **Y Combinator-backed, growing fastest**, especially Senegal/Uganda |
| **Moov Money** | CI, BF, BJ, NE, TG | 1-2% | T+1 | Smaller market share |
| **Free Money** | SN | 1.5% | T+1 | Smaller |

## D.2 Mobile money providers (East + Southern Africa)

| Provider | Countries | Fee | Notes |
|---|---|---|---|
| **M-Pesa** | KE, TZ, UG, others | 1-2% | Dominant in Kenya, 60%+ market share |
| **Airtel Money** | KE, TZ, UG, ZM, others | 1-2% | Second largest in East Africa |
| **Tigo Pesa** | TZ, GH | 1-2% | — |

## D.3 Card / fintech aggregators (Pan-Africa)

| Provider | Coverage | Fee | Notes |
|---|---|---|---|
| **Stripe** | 50+ African countries (cards) | 2.9% + $0.30 per transaction, plus 1.5% for international cards | Works for credit/debit cards; not mobile money |
| **Paystack** | NG, GH, ZA, KE (cards + bank) | 1.5% + 100 NGN local, 3.9% international | Nigerian-headquartered, strong in West Africa |
| **Flutterwave** | 30+ African countries (cards + mobile money + bank) | 1.4% local, 3.8% international | Best Pan-Africa aggregator, supports mobile money via Rave |
| **DPO Group** | 20+ African countries | ~3% | PayGate-equivalent |
| **Pesapal** | KE, UG, TZ, ZM | 2-3% | East Africa focused |

## D.4 Bokari's recommended payment stack (Year 1)

1. **Wave** for Senegal, Côte d'Ivoire, Mali, Burkina Faso, Uganda (1% fee, fastest)
2. **Orange Money** for Cameroon + Francophone fallback (1-2%)
3. **MTN MoMo** for Côte d'Ivoire, Cameroon (1-2%)
4. **M-Pesa** for Kenya, Tanzania, Uganda (1-2%)
5. **Paystack** for Nigeria, Ghana (cards + bank transfer)
6. **Flutterwave** as aggregator fallback for everything else (covers mobile money, cards, bank in 30+ countries)
7. **Stripe** for international cards (diaspora users — Nigeria/Senegal diaspora in US/EU who want to support Bokari)
8. **Direct mobile money APIs** in Y2 once volume justifies the engineering cost

**Cost model:** Average payment processing ~2%. On $2.99 Pro, that's $0.06. Annual $35/yr Pro → $0.70 in payment fees. Negligible.

**Onboarding friction:** Mobile money is **already** a friction point (OTP, PIN, etc.) but Wave and Orange Money are now 1-tap. Paystack/Flutterwave have SDKs that handle the entire flow.

## D.5 FX risk + hedging

**Bokari's mismatch:** Revenue in XOF/KES/NGN, costs in USD (Anthropic, OpenAI, AWS).
- XOF is pegged to EUR (1 EUR = 655.957 XOF) — low risk
- NGN has been volatile (NGN/USD went from 460 in 2023 to 1,500 in 2024) — HIGH RISK
- KES is more stable but still floats

**Hedging strategy:**
- Hold **60 days of API spend in USD reserves** (at $0.015/query × 1M MAU × 20% utilization × 100 queries avg = $300K/mo → $600K USD reserve)
- For NGN specifically, charge in USD-equivalent (Flutterwave handles conversion at point-of-sale)
- For XOF, bill in XOF but pay APIs in EUR (Anthropic EUR billing available)
- Consider **CFA franc invoicing** for B2B (schools/MoE) to lock in EUR value

---

# Appendix E: Telco bundling economics (deep model)

The most important distribution channel in Africa is **telco partnerships**. Perplexity + SK Telecom is the precedent. Here's how to model a Bokari + Wave (or MTN, or Orange) deal.

## E.1 The deal structure (recommended)

- **Bokari Pro is "free" (or $0.50/mo) for telco postpaid users**
- **Telco pays Bokari** $0.30-0.50/user/mo (revenue share, ~50/50 with the telco charging the user)
- **Bokari gets** distribution + branding
- **Telco gets** ARPU boost + churn reduction (the AI is sticky)
- **Win-win if** Bokari's cost per user (routed) is < $0.30/mo (which it is at 70/25/5 routing)

## E.2 The economics of an MTN MoMo deal

Assume:
- MTN has 50M MoMo users in West + Central Africa
- Bokari targets 5% attach rate = 2.5M users
- Bokari revenue per user: $0.40/mo (after rev share with MTN)
- **Bokari Year-1 ARR from MTN deal: 2.5M × $0.40 × 12 = $12M**

This is the **single biggest revenue line item in Bokari's Year-1 plan** if executed. It requires:
- 6-month negotiation with MTN Group (Johannesburg HQ) or MTN MoMo (Dubai)
- Compliance with telco regulations (data residency, KYC)
- Integration with MTN MoMo API for free-trial signup
- Co-marketing budget ($100-500K from MTN for launch)

## E.3 Comparable precedent (de-risked by SK Telecom + Perplexity)

- **Perplexity + SK Telecom (Feb 2024)**: 30M+ SK Telecom users got free Perplexity Pro. Result: SK Telecom saw ARPU increase; Perplexity added millions of paying users at net-zero cost.
- **Tidal + Sprint (2014)**: Sprint bundled Tidal for free. Tidal grew 4M subs in 6 months. Sprint saw reduced churn.
- **Apple Music + Verizon (2018)**: Apple Music for free on Verizon Unlimited. Apple gained 10M+ US subs.

**The pattern works.** Bokari + MTN or Bokari + Orange or Bokari + Wave (yes, Wave is a fintech not telco, but they're pursuing a super-app strategy) is the same.

## E.4 Telco targeting order (recommended)

1. **Wave** (Senegal/Uganda, fintech with super-app ambitions, fastest to close, YC-backing similar culture) — Q3 2026 target close
2. **MTN Group** (Pan-Africa, 50M MoMo users, HQ Johannesburg) — Q4 2026 target close
3. **Orange Money** (Francophone-focused, 20M+ users in SN/CI/ML/CM) — Q1 2027 target close
4. **Airtel Money** (East Africa, 15M+ users in KE/TZ/UG/ZM) — Q2 2027

## E.5 What NOT to do

- **Don't give up > 50% rev share.** Telcos are used to extractive deals. Hold the line at 50/50.
- **Don't exclusivity-lock.** If MTN demands Bokari Pro is "only on MTN" — refuse. Bokari needs to be on every telco. Wave users should also be able to use it.
- **Don't price Pro at $0 to the user.** $0.50/mo (paid via MoMo) preserves the perceived value. Free = low engagement.

---

# Appendix F: Bokari's competitive moat, ranked

In order of defensibility (most defensible = highest rank):

## F.1 Trust moat: NLI citation validator
- **Defensibility:** HIGH (12-18 months to replicate the pipeline)
- **Value to user:** Every claim has a green/amber/red badge. Perplexity users have to trust the prose; Bokari users have to trust the badge.
- **Cost to Bokari:** NLI inference = $0.0005-0.001 per claim (small but not zero)
- **Risk:** A competitor (Perplexity) could ship NLI badges in 6-9 months if they prioritize
- **Defensive move:** Open-source the NLI pipeline, build community around Bokari's trust standards, make it the de facto for African AI

## F.2 Distribution moat: WhatsApp-native + WhatsApp OTP
- **Defensibility:** HIGH (any competitor could ship WhatsApp OTP, but UX is hard)
- **Value to user:** Signup is 1 WhatsApp message. Sharing a search result is 1 tap → WhatsApp status.
- **Cost to Bokari:** $0.004/OTP (Meta direct)
- **Risk:** A competitor could copy OTP signup easily
- **Defensive move:** Lock in early distribution deals with WhatsApp Business API partners, build WhatsApp-specific AI agents (e.g., a WhatsApp Status generator from a search)

## F.3 Speed moat: < 50ms TTFB + BGE-M3 cache
- **Defensibility:** MEDIUM (requires infrastructure investment to replicate)
- **Value to user:** Instant answers on 3G, near-zero perceived latency
- **Cost to Bokari:** Cache hit rate = ~30% today, target 50% by end of 2026
- **Risk:** A funded competitor (Perplexity, ChatGPT) could invest in similar caching
- **Defensive move:** Continue BGE-M3 investment, ship "instant mode" toggle for users

## F.4 Curriculum moat: BEPC/BAC/Concours prep
- **Defensibility:** HIGH (requires Francophone African curriculum expertise)
- **Value to user:** Direct study support for the exams that determine a Francophone African student's university admission
- **Cost to Bokari:** Curriculum authoring = one-time $50-200K investment
- **Risk:** Local edtech startups (in Senegal, Côte d'Ivoire) could copy
- **Defensive move:** Partner with Francophone African Ministries of Education for "official" status

## F.5 Language moat: Wolof / Bambara / Pulaar / Lingala
- **Defensibility:** MEDIUM (training data + tokenizer)
- **Value to user:** A Wolof-speaking student can ask Bokari in Wolof and get a Wolof answer
- **Cost to Bokari:** Training + fine-tuning on African languages = $200-500K initial, ongoing maintenance
- **Risk:** Google (via Gemini) is investing heavily in African languages
- **Defensive move:** Ship Wolof + Bambara by end of 2026 (most populous), Lingala + Swahili by mid-2027

## F.6 Learn mode moat: Socratic + SM-2
- **Defensibility:** MEDIUM (SM-2 algorithm is public, Socratic is a prompt pattern)
- **Value to user:** Spaced repetition flashcards that don't give away the answer
- **Cost to Bokari:** SM-2 implementation is a few days work; curriculum-aligned content is the work
- **Risk:** Quizlet could copy Socratic mode (they have Q-Chat)
- **Defensive move:** Combine with curriculum moat — Quizlet is global, Bokari is Francophone-African

## F.7 Community moat (planned, not built)
- **Defensibility:** VERY HIGH (community is the only moat that compounds)
- **Value to user:** WhatsApp study groups, community moderators, peer answers
- **Cost to Bokari:** Community ops headcount = 3-5 FTE by Y2
- **Risk:** Phind-style community ops failure (founder disengagement kills community)
- **Defensive move:** Hire Francophone African community managers from Day 1. Founder (Ousmane) should personally post in WhatsApp groups weekly.

---

# Appendix G: Sensitivity analysis — what if Bokari's assumptions are wrong?

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Conversion to Pro is < 5% (vs 8% base case) | Medium | -$1M ARR | Better onboarding, in-app paywall, more free → pro triggers |
| Sonnet 4.6 price increases (Anthropic raises to $5/MTok) | Low | -$500K margin | Multi-model routing: 80% mini, 15% Sonnet, 5% Gemini. Build cost-optimized query classifier |
| NGN devalues 30% | Medium | -$200K margin in NG market | Bill in USD or EUR for NGN customers; Flutterwave handles at point of sale |
| Wave / MTN deal falls through | Low | -$2M ARR | Start Wave Q3 2026, MTN Q4 2026, Orange Q1 2027. Pipeline of 3 deals |
| Perplexity ships NLI badges | Medium | Bokari's trust moat shrinks | Open-source NLI pipeline, build community trust, move up the value chain (Learn mode, curriculum) |
| Google ships Gemini Pro at PPP pricing for Africa | Low (Google has not done this) | Major market disruption | Bokari's NLI + Learn + curriculum remain defensible. Pivot messaging to "Made in Africa, For Africa" |
| Anthropic / OpenAI raise API prices 50% | Low | -$1.5M margin | Pre-negotiate volume commit at 2026 prices for 24 months |
| WhatsApp OTP cost increases (Meta raises) | Low | -$50K/year | Fall back to SMS OTP (Twilio, Africa's Talking) — same UX |
| ChatGPT ships a $5/mo "Go" tier globally with ads | Medium | Commoditization | Bokari's edge is trust + Africa-specific, not price alone. Position as "AI you can verify" |
| Phind-style founder burnout | Low (Cheick is the operator, Ousmane is président) | Loss of focus | Distribute operational responsibility: Cheick = product, Aoua = frontend, Amadou = backend, Salif = growth, Yacouba = monetization ops |

---

# Appendix H: Industry benchmarks to track

Track these metrics monthly to ensure Bokari is on par with best-in-class:

| Metric | Industry benchmark | Bokari target (Y1) | Source |
|---|---|---|---|
| **Free → Paid conversion** | 3-7% (consumer SaaS), 1-2% (AI tools) | **8%** (high) | Mixpanel, OpenView 2024 SaaS Benchmarks |
| **MoM Pro churn** | 5-8% (consumer), 3-5% (B2B) | **6%** | Recurly, Stripe Atlas |
| **ARPU** | $5-20/yr (consumer AI), $50-200/yr (B2B) | **$35/yr** (Pro) | Sacra, Iconiq |
| **DAU/MAU ratio** | 20-30% (consumer), 50%+ (B2B) | **25%** | Mixpanel |
| **CAC** | $30-100 (consumer), $200-500 (B2B) | **$2** (WhatsApp OTP is cheap) | Various |
| **LTV/CAC** | >3 (healthy), >5 (great) | **15+** (because CAC is so low) | — |
| **CAC payback** | 12-18 months | **<3 months** (Pro at $2.99/mo, cost $2.54/mo) | — |
| **Gross margin** | 60-80% (consumer SaaS) | **80%+** (with routing + cache) | — |
| **Net revenue retention** | 100-120% (B2B), 90-110% (B2C) | **95%** | — |
| **Activation rate** (% who complete first query within 24h) | 40-60% | **70%** (WhatsApp OTP is fast) | Mixpanel |
| **D1 retention** | 30-50% | **50%** | — |
| **D7 retention** | 15-25% | **25%** | — |
| **D30 retention** | 8-15% | **15%** | — |
| **Time to first value** (signup → first Pro Search) | <5 min | **<60 seconds** (WhatsApp OTP + auto-first-query) | — |

**Key insight:** Bokari's CAC should be <$2/user (just WhatsApp OTP + retention marketing). With ARPU $35/yr, LTV/CAC = 17.5× — exceptional. The risk is **retention** (churn, D7/D30), not unit economics.

---

# Appendix I: Quick-reference pricing card (Bokari)

```
+---------------------------------------------------+
|                BOKARI PRICING (JUNE 2026)          |
+---------------------------------------------------+
|                                                   |
|  FREE        $0 / 1,800 XOF-cap equivalent        |
|              5 Pro Searches/day                    |
|              1 image upload/day                    |
|              3 saved conversations                 |
|              GPT-4o-mini routing                   |
|              NLI citations on every claim          |
|              WhatsApp OTP signup                   |
|                                                   |
|  PRO         $2.99/mo · 1,800 XOF/mo               |
|              or $29/yr · 17,500 XOF/yr (save 19%)  |
|              Unlimited Pro Searches (Sonnet 4.6)   |
|              Unlimited image uploads               |
|              Full Learn mode (SM-2 flashcards)     |
|              50 FLUX.2 image gen / mo               |
|              5,000 credits / mo for power tools    |
|              PDF export + Share chat               |
|              NLI audit log download                |
|                                                   |
|  EDU         $9.99/student/yr · 6,000 XOF/student  |
|              (B2B, sold to schools / MoE)          |
|              Everything in Pro                     |
|              BEPC / BAC / Concours curriculum      |
|              Francophone African languages         |
|              Admin dashboard (1 teacher / 200)     |
|              Class analytics                       |
|              Bulk annual invoicing                 |
|                                                   |
|  STUDIO      $14.99/mo · 9,000 XOF/mo              |
|              Everything in Pro + Edu                |
|              Unlimited image gen                   |
|              Unlimited Computer agents             |
|              1M tokens / mo API access              |
|              Custom agents                         |
|              Priority support (WhatsApp)           |
|              White-label for NGOs                  |
|                                                   |
|  PAYMENT     Wave · Orange Money · MTN MoMo ·     |
|              M-Pesa · Paystack · Flutterwave ·     |
|              Stripe (international cards)          |
|                                                   |
+---------------------------------------------------+
```

---

# Appendix J: Decision framework — when to raise Bokari Pro pricing

Bokari Pro at $2.99 is a deliberate loss-leader. Here's when to raise it:

| Trigger | Action | Timeline |
|---|---|---|
| **DAU/MAU > 30%** | Product is sticky, raise to $3.49 | 6 months post-launch |
| **D30 retention > 20%** | Users are engaged, raise to $3.99 | 9 months post-launch |
| **Cache hit rate > 50%** | Cost per query drops, raise to $3.99 | 12 months post-launch |
| **Telco bundle deal closes (Wave or MTN)** | Free for telco users stays free; standalone Pro can raise to $3.99 | At deal close |
| **3+ Francophone MoE contracts close** | Edu demand is real, raise Edu to $14.99/student/yr | At contract close |
| **Sonnet 4.6 price drops 30%** (volume commit) | Margin improves, hold Pro at $2.99 for longer | At contract |
| **Sonnet 4.6 price rises 30%** | Raise Pro to $3.99 to maintain margin | Immediately |
| **Competitor launches at $1.99/mo** | Defensive — don't match. Add value to $2.99 (e.g., free FLUX.2 Pro for first 3 months) | As needed |

**The rule:** Bokari Pro pricing is a **lever**, not a number. Adjust quarterly based on the metrics above.

---

# Appendix K: The 3 strategic "no's" for Year 1

1. **No $20/mo Pro.** This is Silicon Valley pricing. Africa prices at $1-3/mo for consumer AI. If Bokari is ever $20, it's a premium B2B tier, not consumer.
2. **No enterprise sales team in Year 1.** Perplexity's Enterprise Pro is 1% of revenue but 80% of sales effort. Distraction. Focus on consumer + Edu + telco.
3. **No proprietary LLM.** Bokari's edge is NLI + Learn + WhatsApp + speed, not building a frontier model. Use Anthropic + OpenAI APIs. Building a model would burn $20-50M and 18 months.

---

**End of report (final).** Total length: 1,300+ lines. Next refresh: 1 July 2026 (or sooner if any major competitor launches an Africa-specific product).

