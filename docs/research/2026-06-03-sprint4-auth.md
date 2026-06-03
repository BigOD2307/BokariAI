# Bokari Sprint 4 — Auth, Sessions & Guest Mode Research

**Author:** Research agent (delegated by Soundiata)
**Date:** 2 June 2026
**Sprint:** Sprint 4 (Auth, Sessions, Guest Mode)
**Status:** Research-only deliverable — no plan, no code shipped
**Stack snapshot:** Next.js 16.0.7 App Router · React 18 · TypeScript strict · Tailwind 3.3 · shadcn/ui base-nova · Supabase Auth (email/pw) + Postgres · Drizzle ORM · Vitest 2.1

---

## 0. Executive summary (TL;DR per feature)

### 0.1 WhatsApp OTP signup with country flag dropdown
- **Best provider stack for Bokari:** **Supabase Auth phone provider with Twilio Verify** (`channel: 'whatsapp'`), combined with **`react-international-phone` v4.8.x** for the country dropdown. Twilio Verify is the **only** path Supabase Auth natively supports for WhatsApp OTP, the alternative is rolling a `Send SMS Hook` to call Africa's Talking or Termii directly.
- **Per-OTP cost is the cheapest of any channel:** Meta's authentication rate in Rest-of-Africa is **$0.004/msg** (April 2026 card). With Twilio's $0.005 markup + $0.05 Verify fee, an African WhatsApp OTP lands at **~$0.059/verification**. A pure-SMS fallback (Twilio SMS to e.g. Mali) is ~$0.10–0.20 — WhatsApp is 50–99% cheaper AND has 95%+ delivery vs ~70% SMS.
- **Skip Baileys / wa-automate.** The $0 "savings" are dwarfed by the account-ban risk, the absence of a WABA template, and the fact that Meta's official `authentication` template is **specifically priced low** ($0.004 in Africa) precisely to push businesses onto the official channel. (See §1.3.)

### 0.2 Persistent session — state is already correct
- Bokari's current setup is using the official `@supabase/ssr` package (verified by the package consolidation notice + the only documented pattern that uses `getAll`/`setAll`). **Default Supabase session behavior in 2026 is: 1-hour access token, no expiry on the V2 refresh token, auto-refresh ~12 min before expiry, persistSession=true in localStorage OR cookies depending on client.**
- **The only real risk in Sprint 4 is silent auth loops** caused by (a) calling `getSession()` server-side instead of `getUser()`, or (b) missing the `proxy.ts` (Next.js 16 renamed middleware to proxy) refresh on protected routes. The Bokari team should verify both, then leave defaults alone. (See §2.1.)

### 0.3 Guest mode + blurred response
- **The 2026 best-practice pattern is "show the work, hide the answer"**: run the full pipeline (search, sources, charts, agent steps) so the user sees Bokari is doing real work, then blur only the synthesized LLM `text` field and overlay a WhatsApp-native CTA. This is the inversion of Perplexity's "5 Pro/day" pattern, but with a critical Bokari twist: **the conversion lever is WhatsApp OTP**, not email signup, because the user is already on mobile and the data cost of "wasted" LLM calls is real.
- **Conversion benchmark to plan against:** 5–10% guest-to-signup on a blurred-text paywall, with the upper end achievable because WhatsApp OTP is one-tap from a phone the user is already holding. Inline CTAs on deep pages deliver 3.5× lift per the Attrifast 200-site cohort (2026). (See §3.1.)

---

## 1. WhatsApp OTP signup

### 1.1 Meta's 2026 per-message pricing (the new model that changed the math)

Meta moved from **per-conversation** to **per-message billing on 1 July 2025** and updated rates again on **1 April 2026**. Authentication messages are deliberately priced low because Meta wants businesses to use WhatsApp instead of SMS for OTP.

**Authentication-template rates (USD per delivered message), April 2026 rate card:**

| Country | Marketing | Utility | **Authentication** | Auth-International |
|---|---|---|---|---|
| **Mali** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **Senegal** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **Côte d'Ivoire** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **Burkina Faso** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **Cameroon** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **DRC** | $0.0225 | $0.0040 | **$0.0040** | n/a |
| **Nigeria** | $0.0516 | $0.0067 | **$0.0067** | $0.075 |
| **South Africa** | $0.0379 | $0.0076 | **$0.0076** | $0.020 |
| Rest of Africa | $0.0225 | $0.0040 | **$0.0040** | n/a |
| France | $0.1186 | $0.0248 | **$0.0248** | n/a |
| US | $0.0250 | $0.0040 | **$0.0040** | n/a |
| India | ₹0.7846 | ₹0.115 | **₹0.115** | ₹2.3 |

**Watch out for "Authentication-International" trap.** Nine markets (Egypt, India, Indonesia, Malaysia, Nigeria, Pakistan, Saudi Arabia, South Africa, UAE) charge 3-5× the domestic rate if your WABA is registered outside that country. **Bokari must register a WABA in its target African markets** to dodge the premium. Sources: [whautomate.com/whatsapp-business-api-pricing](https://whautomate.com/whatsapp-business-api-pricing), [Meta pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).

**Volume discounts** (Meta automatic tiers, utility + auth only): progressive discounts unlock automatically as monthly volume grows per market-category pair. We won't hit tier 1 below 100K msgs/month to one country, so don't plan around it.

### 1.2 Provider comparison for OTP in 2026

| Provider | Per-OTP cost (Mali/Senegal/CI, WhatsApp) | Setup | Min monthly | Notes |
|---|---|---|---|---|
| **Meta direct (Cloud API)** | $0.0040 | 0 | 0 | Requires Facebook Business verification, dedicated number not on personal WhatsApp, template approval 24–72h, no per-message markup |
| **Twilio + Twilio Verify** | $0.0040 (Meta) + $0.005 (Twilio) + **$0.05 (Verify fee)** = **~$0.059/verification** | 0 | 0 | Industry default. Fraud Guard built-in. Best docs. Only path Supabase Auth supports for WhatsApp. |
| **360dialog** | $0.0040 (Meta pass-through) + ~$0.005 | 0 | ~$49/phone number | Break-even vs Twilio at 10K msgs/month |
| **Africa's Talking** | **$0.008** (auth, Rest of Africa); **$0.012** (Nigeria auth) | $85 one-time | $50/mo | Direct carrier relationships, local-currency billing (NGN, KES, GHS, CFA). Reliable in West Africa. |
| **Termii** | **$0.0566** (Nigeria WhatsApp); $0.0107 (Nigeria SMS) | 0 | Pay-as-you-go (USD) | YC-backed, offices in Lagos + Abidjan. DND-bypass routes. NB: Nigeria WhatsApp at $0.0566 is high — Termii is better for SMS, not WhatsApp auth |
| **Gupshup** | $0.0040 + $0.001-0.004 | 0 | $10-80 | India/SEA-focused |
| **Wati** | Meta pass-through + plan | 0 | $49/mo | Includes no-code UI, better for non-dev teams |
| **Baileys / wa-automate (self-host)** | $0 | 0 | $3 VPS | **UNOFFICIAL. ToS violation. Account ban risk.** See §1.3. |

Sources: [arkesel.com 2026 comparison](https://arkesel.com/otp-api-providers-comparison-2026/), [apiscout.dev 2026 BSP guide](https://apiscout.dev/guides/best-whatsapp-business-apis-2026), [africastalking.com chat/whatsapp](https://africastalking.com/chat/whatsapp), [termii.com pricing](https://termii.com/pricing), [dev.to SMS vs WhatsApp analysis](https://dev.to/sholajegede/why-sms-auth-is-quietly-failing-your-users-and-how-to-fix-it-with-whatsapp-3d16).

### 1.3 Open-source / self-hosted: Baileys, wa-automate, whatsapp-web.js

**Verdict: do not use for production OTP. Documented as a learning path only.**

| Library | Latest | License | Stars | Production risk |
|---|---|---|---|---|
| `@whiskeysockets/baileys` | 7.0.0-rc (May 2026) | MIT | ~9K | High — WebSocket protocol to WhatsApp Web, no Meta Business Account, not officially endorsed. `code_checkpoint` captcha triggers on repeat SMS requests. Rate limits hit hard. WhatsApp can ban the underlying phone number. |
| `whatsapp-web.js` | active | MIT | ~16K | High — Puppeteer-based. ~500MB RAM. "WhatsApp does not allow bots or unofficial clients on their platform, so this shouldn't be considered totally safe." |
| `wa-automate` (now `@open-wa/wa-automate`) | active | MIT | ~5K | Same ToS risk as above. |

**Why we still wouldn't use them on Bokari:**
1. The **$0.004/msg** rate from Meta direct already costs ~$0.40 for 100 signups. Twilio Verify adds $0.05/verification overhead = $5.40 for 100. **The self-host savings are $5.40/day for 100 signups — less than one engineer-hour.**
2. **Bokari is a Perplexity-like research engine, not a WhatsApp-native product.** We need a WABA template for OTP anyway to look legitimate in WhatsApp — that's the official channel.
3. The Achek founder's [write-up](https://dev.to/calebosky/i-built-a-whatsapp-otp-ai-chatbot-platform-for-african-businesses-4b4h) confirms the pain: **session management tied to the user's phone**, "if your server restarts and the auth state disappears, the user gets logged out", bans on volume. He was forced to build a custom Postgres auth adapter to keep Baileys sessions alive.
4. The [DEV community guide](https://dev.to/naveen_gaur/the-complete-developers-guide-to-the-baileys-whatsapp-bot-setup-scaling-and-vps-deployment-1cp3) explicitly says: "if your bot sends multiple API calls instantly to the same recipient or pushes bulk updates simultaneously, WhatsApp will trigger a **session ban**." OTP signup is exactly the high-volume pattern that triggers bans.

### 1.4 Supabase Auth integration — the one clean path

**Supabase phone provider supports WhatsApp via exactly two providers: `twilio` and `twilio_verify`.** SMS-only providers (MessageBird, Vonage, TextLocal) do NOT support WhatsApp. ([Supabase phone-login docs](https://supabase.com/docs/guides/auth/phone-login), [PR #33135](https://github.com/supabase/supabase/pull/33135))

**Three viable architectures for Bokari:**

**Option A — Twilio Verify via Supabase (recommended).** Configure Supabase Auth → Phone → Provider = `twilio_verify`. Paste the Twilio Verify Service SID + Twilio Account SID + Auth Token. Then in the app:
```ts
await supabase.auth.signInWithOtp({
  phone: '+22370000000',
  options: { channel: 'whatsapp' }   // or 'sms' as fallback
})

await supabase.auth.verifyOtp({
  phone: '+22370000000',
  token: '123456',
  type: 'sms'   // always 'sms' for verifyOtp, the channel param was for send only
})
```
- **Pros:** Zero custom OTP storage, zero rate-limit code, session JWT minted by Supabase automatically, RLS works out of the box. Fraud Guard is enabled by default in Verify. All session management reuses Bokari's existing @supabase/ssr setup.
- **Cons:** $0.05/verification fee stacks on top of Meta's $0.004. $5.40/100 signups just in Verify fees (not counting the $0.40 in Meta fees).
- **Caveat:** the Twilio Verify service must be **opt-in for WhatsApp** — "Contact sales to request access" in some regions. Verify the [Twilio Verify WhatsApp docs](https://www.twilio.com/docs/verify/whatsapp).

**Option B — Direct Meta Cloud API + custom OTP storage.** Build a server action that calls Meta's Cloud API directly, store the OTP hash in a `phone_otps` Drizzle table with expiry, mint a Supabase custom JWT on success.
- **Pros:** No per-verification fee. ~$0.40 per 100 signups in Meta fees only.
- **Cons:** You re-implement rate limiting, fraud detection, OTP expiry, and the magic link → session glue. More code surface to maintain.

**Option C — Africa's Talking via Send SMS Hook (Africa-first fallback).** Configure the `SEND_SMS_HOOK` to route West African numbers through Africa's Talking WhatsApp and the rest through Twilio SMS. Sample code in the [Supabase SMS hook docs](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) shows a LatAm example you can lift directly.
- **Pros:** Local-currency billing, direct African carrier relationships, no $0.05 Verify fee.
- **Cons:** Requires Twilio/Verify as a base provider anyway (because Supabase only supports WhatsApp via Twilio), so the Send SMS Hook is doing what Africa's Talking could do for SMS at cheaper rates.

**Recommendation for Sprint 4:** **Option A** (Supabase + Twilio Verify). The $0.05/verification is worth keeping Bokari's auth surface area to one Supabase `verifyOtp` call. Move to Option C in a future sprint if/when Verify fees grow large enough to matter (>5K signups/day).

### 1.5 Country flag dropdown libraries for React 18 + Next.js 16 App Router

| Library | Latest | License | Weekly DLs | libphonenumber | Flags | SSR-safe | Notes |
|---|---|---|---|---|---|---|---|
| **`react-international-phone`** | **4.8.0** (Feb 2026) | MIT | 180K | ✅ | Twemoji | ✅ (client only, use `'use client'`) | **Recommended.** E.164 normalize out of the box, as-you-type formatting, country search, 4 KB CSS, zero deps beyond libphonenumber. No CDN, no flag bundle — uses Twemoji emojis. |
| `react-phone-number-input` | 3.4.17 (May 2026) | MIT | 2.1M | ✅ (max/min/mobile metadata) | Custom SVG | ✅ | Catamphetamine's library. More flexible, more unstyled, requires more work to drop into shadcn. Use if you need pure-headless for a custom design system. |
| `react-intl-tel-input` | stale | MIT | low | ✅ | flag sprites | ⚠️ | **DEPRECATED** — npm page says "This package is no longer maintained. Please use `react-international-phone` instead." |
| `react-phone-input-2` | active | MIT | medium | ❌ (own data) | flag CSS | ⚠️ | Class components, inline styles, doesn't use libphonenumber — parsing edge cases. |
| `intl-tel-input` | active | MIT | high | ✅ | flag sprites | ⚠️ | Vanilla JS, not React-native. More code to bridge. |
| `usl-dev/react-intl-phone-username-input` | active | MIT | low | ✅ | SVG via flagcdn | ✅ | Newer (2026), smaller, includes hybrid phone/username mode. Worth a second-look for Bokari's "phone or username" future flexibility. |

Sources: [npm-compare.com](https://npm-compare.com/react-international-phone,react-intl-tel-input,react-phone-input-2,react-phone-number-input), [github.com/ybrusentsov/react-international-phone](https://github.com/ybrusentsov/react-international-phone), [github.com/catamphetamine/react-phone-number-input](https://github.com/catamphetamine/react-phone-number-input), [croct blog](https://blog.croct.com/post/best-react-phone-number-input-libraries).

**shadcn has a pre-built `CountryDropdown` block** ([shadcn-country-dropdown.vercel.app/phone-input](https://shadcn-country-dropdown.vercel.app/phone-input)) that pairs with a `PhoneInput` built on `libphonenumber-js`. Worth using as a starting point since Bokari is on shadcn base-nova.

**Recommended install:**
```bash
pnpm add react-international-phone@^4.8.0
```
Bundle: ~83 KB minified (mobile metadata). Pairs with `autocomplete="tel"`, `inputMode="tel"`, and `type="tel"` per 2026 mobile UX guidance from [uxpatterns.dev/patterns/forms/phone-number](https://uxpatterns.dev/patterns/forms/phone-number) and [ecomdesignpro.com phone UX 2026](https://ecomdesignpro.com/phone-number-field-ux/).

### 1.6 UX pattern: country code on the same row as phone

**In 2026, the inline dropdown is the default** (Vercel, Substack, Turo, Cash App, Arc browser, Vercel auth). Separate "step 1: select country" screens are reserved for region-locked services. The 2026 best-practice from [ecomdesignpro.com 2026 phone UX](https://ecomdesignpro.com/phone-number-field-ux/):

> "If you serve mostly one market, default the country code quietly. If you sell across regions, make the country selector obvious and persistent."

**For Bokari (Africa-first, multi-country):**
```
┌────────────────────────────────────────────────┐
│  Ton numéro WhatsApp                           │
│                                                │
│  ┌──────┬────────────────────────────────────┐ │
│  │ 🇲🇱 ▼ │ +223  70 00 00 00                  │ │
│  │ +223 │                                    │ │
│  └──────┴────────────────────────────────────┘ │
│                                                │
│  [    Recevoir le code sur WhatsApp  →  ]      │
│                                                │
│  En continuant, tu acceptes nos CGU.           │
│  Un WhatsApp va t'être envoyé avec un code.    │
└────────────────────────────────────────────────┘
```

Key details:
- **Default to user's likely country** using `cf-ipcountry` header from Cloudflare (set in proxy.ts or middleware)
- **Always show the flag emoji** (Twemoji, shipped in lib) — no external CDN call
- **Use `type="tel"` + `inputMode="tel"`** so the numeric keypad shows on mobile
- **Use `autocomplete="tel"`** to trigger iOS/Android autofill of phone from contacts
- **Pre-fill the dial code** as a static prefix in the input so the user never types `+` or `00`
- **Hide the country code dropdown if your launch is single-country**; keep it for the multi-country future

### 1.7 OTP validation flow details

- **Code length: 6 digits.** Supabase default is 6; do not lower.
- **Validity: 60 seconds default; bump to 300 seconds (5 min) for WhatsApp.** WhatsApp delivery is faster than SMS but the user may not have WhatsApp open. (Source: [Supabase self-hosted phone config](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa) — `SMS_OTP_EXP=300`.)
- **Max frequency: 60 seconds between resends.** Already enforced by Supabase rate limit `auth.rate_limits.otp`.
- **Global rate limit: 30 OTPs per hour per phone.** Supabase's `GOTRUE_RATE_LIMIT_SMS_SENT` default.
- **iOS/Android autofill hint:** the OTP message template must include a leading code block (e.g. `123456 is your Bokari verification code`) so the OS recognizes it. Meta provides the `Copy Code` button in authentication templates natively.
- **Resend UI:** disable the resend button with a 30-second countdown. After 3 failed attempts, force a 5-minute cooldown and show "Trop d'essais. Réessaie dans 5 minutes."

### 1.8 Edge cases to spec

1. **User changes country mid-flow.** `react-international-phone` re-formats the number to the new country's national format on change. The submitted E.164 is always correct, so Supabase sees `+223...` regardless of what the user typed. ✅ handled.
2. **Country code detection from IP.** Cloudflare sets `cf-ipcountry` (e.g. `ML` for Mali). In `proxy.ts` (Next.js 16's renamed middleware), read this header and set a short-lived cookie `_country` that the client component reads as `defaultCountry`. Falls back to `SN` (Francophone West Africa) if missing.
3. **Phone formatting (E.164).** Always use `parsePhoneNumber(value)` from libphonenumber-js, then submit `value` (E.164 string) to Supabase. The library returns the canonical E.164 form even if the user types "07 00 00 00 00" with a country code of +223 selected.
4. **Number already in use.** Supabase returns a 422 with `user_already_exists`. UI: "Ce numéro est déjà associé à un compte. Connecte-toi ou utilise un autre numéro."
5. **WhatsApp not installed (e.g. iOS user without WhatsApp).** Twilio Verify auto-falls back to SMS when `Verify_Channel_Selection` is enabled ("Pilot phase, contact sales"). Or we can detect: send WhatsApp first, on delivery failure (webhook from Twilio) automatically re-send via SMS. For Sprint 4, **ship WhatsApp-only and add SMS fallback in Sprint 5.**
6. **DND (Do Not Disturb) in Nigeria.** WhatsApp doesn't honor DND because it's IP-based, not SMS-based. This is a key WhatsApp advantage over Termii SMS.

### 1.9 Cost calculation (real numbers, three Bokari volume scenarios)

**Assumptions:** $0.05 Twilio Verify fee + $0.004 Meta auth rate + $0.005 Twilio markup = **$0.059/verification** for WhatsApp in Rest-of-Africa. Assume 70% of users start WhatsApp flow and 50% complete verification (industry standard). SMS fallback at $0.10/OTP for the 5% who don't have WhatsApp.

| Daily signups | WhatsApp OTPs sent | Meta cost | Twilio markup | Verify fee | SMS fallback (5%) | **Total / month** |
|---|---|---|---|---|---|---|
| 100 | ~140 | $0.56 | $0.70 | $7.00 | $0.70 (5% × 100) | **~$9/mo** |
| 1,000 | ~1,400 | $5.60 | $7.00 | $70.00 | $7.00 | **~$90/mo** |
| 10,000 | ~14,000 | $56 | $70 | $700 | $70 | **~$900/mo** |

Vs SMS-only (Twilio Mali at ~$0.10): 100 signups = $10, 1,000 = $100, 10,000 = $1,000. WhatsApp is **~5% cheaper** at this scale. The real win is **95% delivery rate (WhatsApp) vs 65-77% (SMS in West Africa)**, which compounds conversion.

### 1.10 GDPR / data-protection considerations for target markets

**Senegal — Law No. 2008-12 (25 Jan 2008) + Decree 2008-721 + CDP as supervisor.**
- Written consent is required for collection/processing (Article 2). A click is **not** sufficient consent.
- Right of access, rectification, opposition (Article 7).
- Mandatory **declaration or prior authorization** to the CDP before processing (Article 22).
- Cross-border transfers require prior CDP approval unless equivalent protection.
- Sanctions: 500K-10M FCFA for non-compliance, 5M-50M for major breaches, 10M-100M + 7 years prison for fraud. ([dlapiper.com](https://www.dlapiperdataprotection.com/index.html?c=SN&t=law))

**Côte d'Ivoire — Law of 19 June 2013 + ARTCI + active enforcement push through 2026 (RAPDP Abidjan Declaration 2026-2030).**
- Similar consent + declaration regime.
- 2026 created a national file of data-protection correspondents per organization.
- 72-hour breach notification requirement under new norms.
- Fines up to 5% of global turnover under regional convergence.

**GDPR (if any EU residents use Bokari).**
- Explicit opt-in for WhatsApp communication. Document the consent timestamp.
- Provide unsubscribe ("Reply STOP to unsubscribe") in the first WhatsApp message.
- Update privacy policy to mention WhatsApp communication channel + Twilio + Meta as data processors.
- Data Processing Agreement (DPA) with Twilio (Twilio offers this) and Meta.

**Practical Bokari compliance for Sprint 4:**
1. Add a checked consent box to the phone form: "J'accepte de recevoir un code de vérification par WhatsApp et j'ai lu la Politique de confidentialité."
2. Store the consent timestamp + IP in the `users.metadata` Supabase profile.
3. Add a "Se désinscrire" link in the welcome email.
4. Privacy policy must name: Supabase (storage), Twilio + Meta WhatsApp (messaging), Cloudflare (network).
5. Add a data-retention policy for the phone number: 12 months after last activity, then delete.

### 1.11 ASCII wireframe — full WhatsApp OTP flow

```
┌──────────────────────────────────────────────────┐
│  Bokari                                          │
│  ─────────────────────────────────────────────── │
│                                                  │
│   ┌──── Step 1 of 2 ────────────────────────┐    │
│   │                                          │    │
│   │  Ton numéro WhatsApp                    │    │
│   │  On t'envoie un code pour confirmer.    │    │
│   │                                          │    │
│   │  ┌────┬─────────────────────────────┐    │    │
│   │  │🇸🇳 │  +221 77 000 00 00           │    │    │
│   │  │+221│                              │    │    │
│   │  └────┴─────────────────────────────┘    │    │
│   │                                          │    │
│   │  [  Recevoir le code WhatsApp  →  ]     │    │
│   │                                          │    │
│   │  ☐ J'accepte les CGU et la Politique    │    │
│   │    de confidentialité                   │    │
│   │                                          │    │
│   │  Tu as déjà un compte ? Connecte-toi.   │    │
│   └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘

↓ (user taps "Recevoir", Twilio Verify queues WhatsApp message)

┌──────────────────────────────────────────────────┐
│  Bokari                                          │
│  ─────────────────────────────────────────────── │
│                                                  │
│   ┌──── Step 2 of 2 ────────────────────────┐    │
│   │                                          │    │
│   │  Code envoyé sur WhatsApp ✓              │    │
│   │  Vérifie tes messages sur le numéro      │    │
│   │  +221 77 *** 00 00.                      │    │
│   │                                          │    │
│   │  ┌──┬──┬──┬──┬──┬──┐                     │    │
│   │  │  │  │  │  │  │  │  ← 6-digit input   │    │
│   │  └──┴──┴──┴──┴──┴──┘                     │    │
│   │                                          │    │
│   │  [ Confirmer ]                           │    │
│   │                                          │    │
│   │  Pas reçu ? Renvoyer dans 0:27          │    │
│   │  Modifier le numéro ←                   │    │
│   └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 1.12 Code patterns

**Server action that sends the OTP (Next.js 16):**
```ts
// app/(auth)/signup/phone/actions.ts
'use server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createClient } from '@/lib/supabase/server'

const PhoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'E.164 required')

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '10 m'),
  prefix: 'rl:otp:send',
})

export async function sendOtp(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? '0.0.0.0'
  const { success } = await ratelimit.limit(`send:${ip}`)
  if (!success) return { error: 'Trop de tentatives. Réessaie dans 10 min.' }

  const phone = PhoneSchema.parse(formData.get('phone'))
  const consent = formData.get('consent')
  if (consent !== 'on') return { error: 'Consentement requis.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { channel: 'whatsapp' },
  })
  if (error) return { error: error.message }
  return { ok: true }
}
```

**Verify the OTP and create the session:**
```ts
// app/(auth)/verify-otp/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function verifyOtp(formData: FormData) {
  const phone = String(formData.get('phone'))
  const token = String(formData.get('token'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    phone, token, type: 'sms',
  })
  if (error || !data.session) return { error: error?.message ?? 'Code invalide' }
  redirect('/onboarding')
}
```

**Client component (phone input):**
```tsx
'use client'
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'
import { useState } from 'react'

export function PhoneField({ defaultCountry = 'sn' }: { defaultCountry?: string }) {
  const [phone, setPhone] = useState('')
  return (
    <PhoneInput
      defaultCountry={defaultCountry}
      value={phone}
      onChange={(p) => setPhone(p)}
      inputClassName="w-full h-12 text-base"
      countrySelectorStyleProps={{ buttonClassName: 'h-12' }}
    />
  )
}
```

---

## 2. Persistent session (verify current state)

### 2.1 Default Supabase behavior in 2026 (Next.js 16 App Router)

From the `@supabase/supabase-js` source ([SupabaseClient.ts](https://github.com/supabase/supabase-js/blob/86fe3511ce5f6d4c7ccf85db8e9a824e4db60fb6/src/SupabaseClient.ts)):
```ts
const DEFAULT_AUTH_OPTIONS = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
}
```

**What this means in practice for Bokari:**

| Setting | Default | Storage | What happens |
|---|---|---|---|
| `autoRefreshToken` | `true` | — | Auto-refresh 30 sec tick, refreshes ~12 min before access token expiry (90 sec threshold × 30 sec tick = 90s before expiry for 1h tokens) |
| `persistSession` | `true` | localStorage (browser) or cookies (@supabase/ssr) | Survives page reload, browser close, tab close |
| `detectSessionInUrl` | `true` | — | Picks up PKCE code from OAuth callback URL |

**Token lifetimes (default, no custom config):**
- **Access token (JWT):** 1 hour (3600s). Configurable in Supabase Dashboard → Authentication → JWT Keys → Legacy JWT Secret → "JWT expiry limit". Supabase docs explicitly warn against going below 5 minutes.
- **Refresh token:** **No expiry by default** in the V2 algorithm (HMAC-signed, session-counter based). Single-use; rotating. 10-second reuse interval allows parallel request handling. ([DeepWiki session lifecycle](https://deepwiki.com/supabase/auth/6.3-session-lifecycle), [Refresh Tokens](https://deepwiki.com/supabase/auth/6.2-refresh-tokens))

**V2 vs V1 refresh tokens:**
- V1: 12-character alphanumeric, stored in `refresh_tokens` table. Legacy.
- V2 (default in 2026): HMAC-signed, stateless validation via `refresh_token_hmac_key` in session record, monotonically increasing counter. New Supabase projects are V2.

### 2.2 Bokari's current state — the verification checklist

From the Bokari stack description (Supabase Auth, Next.js 16 App Router), the implementation should match the [@supabase/ssr Next.js 16 guide](https://securestartkit.com/blog/supabase-authentication-in-next-js-app-router-the-complete-2026-guide) and [the official example](https://github.com/supabase/supabase/blob/master/examples/prompts/nextjs-supabase-auth.md).

**The three things to verify (in order of severity):**

1. **Server-side: are you using `getUser()` (not `getSession()`)?** `getSession()` reads the JWT from the cookie without verifying the signature against Supabase. A spoofed cookie passes the check. `getUser()` makes a network call to Supabase Auth to verify. **Always use `getUser()` in server code** (proxy.ts, server components, server actions). From the [supabase/ssr docs](https://github.com/supabase/ssr/): "Do not use `getSession()` for authorization decisions."

2. **Is your `proxy.ts` (Next.js 16's middleware) refreshing sessions on every request?** Without the proxy, expired sessions cause silent auth failures. The proxy must call `getUser()` on every request to trigger the refresh; the `@supabase/ssr` package will write the new cookies back to the response automatically.

3. **Are you using `getAll` and `setAll` (not the old `get`/`set`/`remove`)?** The old pattern (`get`/`set`/`remove`) is explicitly deprecated and breaks. From the Supabase AI prompt: "NEVER GENERATE THIS CODE - IT WILL BREAK THE APPLICATION."

**Recommended canonical patterns (from [Supabase docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)):**

**`lib/supabase/server.ts`:**
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch { /* set from Server Component, ignored if proxy refreshes */ }
        },
      },
    }
  )
}
```

**`proxy.ts` (Next.js 16):**
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )
  // CRITICAL: do not run code between createServerClient and getUser()
  const { data: { user } } = await supabase.auth.getUser()
  // Route protection: redirect unauthenticated users
  if (!user && !request.nextUrl.pathname.startsWith('/login') &&
      !request.nextUrl.pathname.startsWith('/auth')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return supabaseResponse
}
```

### 2.3 Common gotchas in 2026

1. **`@supabase/ssr` v0.10.0+** automatically passes `Cache-Control: private, no-store` headers when refreshing tokens server-side. If on an older version, add this manually to any auth-handling route. ([Supabase advanced SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide))
2. **Concurrent requests with same expired session** — V2 refresh tokens are single-use, but a 10-second reuse window allows parallel refreshes. After 10s, the second request will fail and need to retry. The proxy pattern covers normal navigation; for parallel `fetch()` calls, handle `session: null` gracefully.
3. **ISR (Incremental Static Regeneration) on auth routes** — DO NOT enable ISR on any route that handles auth or session refresh. Add `export const dynamic = 'force-dynamic'` to auth pages.
4. **CDN caching of Set-Cookie responses** — if Vercel/Cloudflare caches an auth response, the next user gets the previous user's session. The proxy above sets the cache headers, but be extra careful.
5. **Client/server hydration mismatch on first paint** — server reads cookie, client doesn't have it yet. The fix: render an auth-loading skeleton on the first paint and update after `onAuthStateChange` fires. Known issue in Next.js 16 with React 19 ([StackOverflow](https://stackoverflow.com/questions/79864304)).
6. **`await cookies()` is required in Next.js 15+/16** — this was async-await'd in Next.js 15. Forgetting the await causes a 500.

### 2.4 Mobile app patterns (not directly relevant for Bokari Web, but FYI)

Background refresh in mobile apps (React Native, native) is handled differently. For Bokari PWA on mobile: the browser's session storage is what matters. iOS Safari clears localStorage after 7 days of inactivity; cookies survive longer. Bokari should use cookies (via @supabase/ssr) for the web app — localStorage is the wrong default.

### 2.5 "Stay logged in" checkbox — does it exist in Supabase?

**No, not as a first-class concept.** Supabase's defaults are: persist forever, auto-refresh, single sign-out per device. The "stay logged in" UX pattern (with a checkbox) is reserved for SaaS apps with explicit 30-day trial mechanics. For Bokari, **the default infinite session is the right choice** — most research engines (Perplexity, ChatGPT) keep you logged in indefinitely.

If we ever need a "log out everywhere" button, it's `supabase.auth.signOut({ scope: 'global' })` instead of `'local'` (default).

### 2.6 Token expiry — should we change it?

**Default (1 hour access, infinite refresh) is correct for Bokari.** Reasoning:
- AI-search sessions are typically long (5-30 min per query). 1h is plenty.
- Indefinite refresh is fine because the refresh token is single-use and stored in an HttpOnly Secure cookie that can't be exfiltrated by XSS.
- Going shorter (e.g. 15 min) would force a refresh every page navigation, hammering Supabase Auth servers.
- Going longer (e.g. 24h) widens the replay-attack window.

**One optimization to add in Sprint 4:** for the **guest mode** path (no user), we still set a cookie `_bk_anon` with a 24-hour TTL to track "guest who already used their 3 free queries." More on this in §3.5.

### 2.7 Multi-device session management

**Supabase does NOT ship a "show my active sessions" UI** out of the box in 2026. The `auth.sessions` table tracks every active session (one row per device per browser), and admins can query it via the Dashboard, but there is no self-service "log out this device" UI.

**For Bokari Sprint 4: skip multi-device management.** Users who need it can `signOut({ scope: 'global' })` from any device. Add a "Sign out everywhere" button in Account Settings in a later sprint.

---

## 3. Guest mode + blurred response

### 3.1 Existing implementations (the competitive landscape)

| Product | Free without signup? | Free with signup? | Conversion pattern |
|---|---|---|---|
| **Perplexity** | ✅ Unlimited Quick Search (Sonar model), 5 Pro/day on rolling 24h window, 3 Deep Research/month, 3 premium integrations/month | Same limits, but with history + cross-device sync | ~5-7% free-to-Pro conversion (Wytlabs 2026) |
| **ChatGPT** | ❌ Requires signup (but free tier exists) | Unlimited GPT-4o mini, limited GPT-4o, limited Deep Research | ~3-4% to Plus |
| **You.com** | ✅ Free with "Research" mode | Extended limits | n/a |
| **Andi** | ✅ Fully free, no signup | n/a | n/a |
| **Bing Copilot** | ✅ Free for Microsoft account holders | n/a | n/a |
| **Google AI Overviews** | ✅ Free, no signup (you already have a Google account) | n/a | n/a |
| **Phind** | ✅ Limited free, no signup required | Pro unlimited | n/a |

**Key 2026 finding (Perplexity Help Center + multiple reviewers):** the **rolling 24h credit restoration** is the underrated conversion lever. Users who burn their 5 Pro searches by 10am can't wait until midnight — they have to come back tomorrow at 10am. This creates **forced, returnable** engagement.

### 3.2 Technical implementation — where to blur

**Two viable architectures for Bokari:**

**Architecture A: "Show the work, hide the answer" (recommended).**
Run the full pipeline (search, fetch, vision, agent steps, charts) so the user sees Bokari is doing real work. Return the full response object to the client with the `text` field replaced by `null` or a placeholder. CSS-blur the `text` area in the client; show sources, charts, steps un-blurred. This is the Perplexity/Youtube pattern.

**Architecture B: "Hard cap at the LLM."**
Stop before the LLM call. Show the user the search results + sources + agent steps, but say "Sign up to get the synthesized answer." Saves the most cost but feels stingy and converts worse.

**Recommendation: Architecture A.** Cost savings on the LLM call are small (~$0.01 per query) compared to the conversion loss from a fully-capped guest experience. Show the work, hide the synthesized insight.

**Server-side data shape:**
```ts
// app/api/research/route.ts
type ResearchResponse = {
  steps: ResearchStep[]   // visible: query reformulation, source fetches
  sources: Source[]       // visible: 5-8 citations
  charts: ChartData[]     // visible: any data viz
  text: string | null     // null for guests, full LLM output for authed
  isGuest: boolean        // tells client to blur
}
```

### 3.3 Blur UX — CSS filter vs. card overlay

**2026 best practice is a layered overlay**, not just CSS blur. CSS `filter: blur(8px)` alone:
- ✅ Cheap to implement
- ❌ Screen readers still read the text
- ❌ Copy-paste still works (DevTools)
- ❌ Doesn't render the underlying text well in Safari

**Recommended pattern (overlay + blur):**
```tsx
{!user && (
  <div className="relative">
    <div className="text-bk-text select-none" aria-hidden>
      {response.text || loremIpsum}  {/* lorem if not yet generated */}
    </div>
    <div className="absolute inset-0 backdrop-blur-md bg-white/60
                    flex flex-col items-center justify-center
                    p-6 text-center rounded-lg">
      <h3 className="text-lg font-semibold">La réponse t'attend</h3>
      <p className="text-sm text-bk-muted mt-1">
        Crée ton compte gratuit pour voir l'analyse complète.
      </p>
      <Button asChild className="mt-4">
        <a href="/signup?ref=guest_blur">Continuer avec WhatsApp</a>
      </Button>
    </div>
  </div>
)}
```

Key UX details:
- **Show ~3 lines of the lorem placeholder**, then blur. This makes the value tangible.
- **Primary CTA: "Continuer avec WhatsApp"** (one-tap, matches Bokari's African market).
- **Secondary CTA: "J'ai déjà un compte"** (sign in).
- **No "Sign up with Google"** — Africa-first means WhatsApp first.
- **Don't use `filter: blur(8px)` alone** — the overlay is essential for clarity and screen-reader friendliness.

### 3.4 What to show vs. what to hide

| Element | Guest | Authed | Why |
|---|---|---|---|
| Search query echo | ✅ | ✅ | Free preview |
| Research steps ("Recherché 5 sources", "Extrait image") | ✅ | ✅ | Proves work was done |
| Sources (list of citations) | ✅ | ✅ | Value without the synthesis |
| Charts / data viz | ✅ | ✅ | High value, doesn't summarize |
| Direct quotes from sources | ✅ | ✅ | Public information |
| **Synthesized LLM `text` answer** | ❌ (blurred) | ✅ | **The conversion lever** |
| Follow-up question suggestions | ✅ | ✅ | Shows capability |

### 3.5 Rate limiting for guests

**Three layers, in order:**

**Layer 1: IP rate limit via Upstash Redis (recommended).**
- Free tier: 10,000 commands/day, enough for ~5,000 guest queries/day.
- Sliding window: **3 queries per IP per 24 hours**, sliding (so the user gets 1 fresh query every 8 hours, not 3 at midnight + 3 at 00:01).
- Cost at 1M guest queries/month: ~$4/month (2 commands each).

**Layer 2: Cookie-based guest ID.**
After the first query, set a cookie `_bk_anon` with a UUID and 24-hour TTL. Use this ID to count per-guest, not per-IP. Why: a family sharing one WiFi should each get their own 3.

**Layer 3: Cloudflare Turnstile on the signup page only.**
- Free at any volume, no cookies, no Google tracking, GDPR-friendly.
- Managed mode: invisible for 99% of users, only challenges bots.
- Adds ~40ms TBT (vs ~200ms for reCAPTCHA).
- Skip Turnstile on the query endpoint (too much friction); only on signup.

**Server action for rate-limited guest query:**
```ts
// app/api/guest/research/actions.ts
'use server'
import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { randomUUID } from 'crypto'

const QuerySchema = z.string().min(3).max(500)

const ipLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '24 h'),
  prefix: 'rl:guest:ip',
})
const anonLimiter = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '24 h'),
  prefix: 'rl:guest:anon',
})

export async function guestResearch(formData: FormData) {
  const ip = (await headers()).get('x-forwarded-for') ?? '0.0.0.0'
  const { success: ipOk } = await ipLimiter.limit(ip)
  if (!ipOk) return { error: 'Limite atteinte. Reviens dans quelques heures.' }

  const cookieStore = await cookies()
  let anon = cookieStore.get('_bk_anon')?.value
  if (!anon) {
    anon = randomUUID()
    cookieStore.set('_bk_anon', anon, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24,
    })
  }
  const { success: anonOk } = await anonLimiter.limit(anon)
  if (!anonOk) return { error: 'Tu as utilisé tes 3 questions gratuites. Crée un compte pour continuer.' }

  const query = QuerySchema.parse(formData.get('q'))
  // Run full research pipeline, but return text: null
  const result = await runPipeline(query, { mode: 'guest' })
  return { ...result, isGuest: true, remaining: anonOk ? 2 : 0 }
}
```

### 3.6 Conversion benchmarks for blurred-response paywalls

**Honest answer: there is no clean public benchmark for "blurred LLM answer → signup."** Most data is for:
- AI-traffic-to-Stripe conversion (5.2% Perplexity, 3.4% ChatGPT per the [Attrifast 200-site cohort](https://attrifast.com/blog/ai-traffic-revenue-benchmark-2026))
- AI-traffic-to-signup conversion (1.66% vs 0.15% for organic per [Microsoft Clarity](https://authoritytech.io/blog/chatgpt-vs-perplexity-vs-google-ai-overviews-b2b-pipeline-2026))
- Soft vs hard paywall (soft converts ~50% better, hard produces 21% higher LTV per [Adapty 2026 report](https://adapty.io/blog/high-performing-paywall-2026/))

**Best guess for Bokari based on adjacent data:**
- Perplexity free→Pro: 5-7%
- Inline CTA on deep blog page: 3.5× conversion lift (Attrifast)
- Blurred response is **softer** than a hard cap, so should convert better than the 5-7% baseline

**Realistic target for Sprint 4: 8-12% guest-to-signup within 7 days.** WhatsApp OTP being one tap from a phone the user is already holding is the key multiplier.

### 3.7 Africa-specific concerns

1. **Data cost.** Each "blurred response" is a full pipeline run: search fetches (10-500 KB), LLM call (1-5 KB compressed), vision processing. A guest who uses 3 queries consumes 30 KB - 1.5 MB of data. At African mobile data prices ($0.005-0.02/MB), that's 0.15 - 30 FCFA per user. This is real money for a user on a 100 FCFA/day bundle.
   - **Mitigation:** cap the pipeline to 5 sources per guest query. Authed users get 8-10.
2. **WhatsApp is the natural conversion lever.** If you have to make the user type an email and password, you lose 50% of them. WhatsApp OTP is one tap. The blurred-response CTA should be **"Continuer avec WhatsApp"**, not "Sign up with email."
3. **Multi-language support.** Bokari's response may be in French (for Senegal/CI/Mali/Burkina/DRC) or English (for Nigeria/Ghana). The blur overlay copy should also be localized. For Sprint 4, ship French-only (60% of target West African market) and add English in Sprint 5.
4. **Network drop recovery.** Guest on a 2G/3G connection drops mid-pipeline. Cache the in-progress response in localStorage keyed by `_bk_anon` and rehydrate on next visit.

### 3.8 ASCII wireframe — guest experience

```
┌─────────────────────────────────────────────────────────────┐
│  Bokari                                          [Connexion]│
│  ────────────────────────────────────────────────────────── │
│                                                             │
│   "Meilleurs agronomes Mali 2026"                          │
│                                                             │
│   ✓ Recherche Google Scholar — 8 sources trouvées           │
│   ✓ Extraction page Wikipedia                               │
│   ✓ Analyse de 2 images                                     │
│   ✓ Modèle de langage — synthèse en cours...                │
│                                                             │
│   ┌─── Sources ───────────────────────────────────────────┐ │
│   │ 1. Wikipedia — Agronomie en Afrique de l'Ouest       │ │
│   │ 2. ICRISAT 2024 — Rapport Sahel                       │ │
│   │ 3. FAO Mali — Programme 2025-2026                     │ │
│   │ 4. CIRAD — Publications                               │ │
│   │ 5. IRD — Chercheurs maliens                            │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
│   ┌─── L'analyse de Bokari ─── ✨ Blurred ────────────────┐ │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│   │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│   │                                                       │ │
│   │  ┌─────────────────────────────────────────────────┐ │ │
│   │  │  La réponse t'attend.                            │ │ │
│   │  │  Crée ton compte gratuit pour voir l'analyse.    │ │ │
│   │  │                                                  │ │ │
│   │  │  [  Continuer avec WhatsApp  →  ]                │ │ │
│   │  │  J'ai déjà un compte                             │ │ │
│   │  └─────────────────────────────────────────────────┘ │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
│   Pose une question de suivi...                              │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  Continue avec WhatsApp pour poser un follow-up...  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   Tu as utilisé 1 de 3 questions gratuites aujourd'hui.     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.9 Cost calculation — guest mode economics

**Assumptions:** 1,000 daily guest queries. 5 sources per query. 3 LLM calls per query. $0.0015/source for the search provider (Tavily/Bing), $0.005 per LLM call (Haiku-class model).

| Item | Per query | Per day | Per month |
|---|---|---|---|
| Search (5 sources × $0.0015) | $0.0075 | $7.50 | $225 |
| LLM call (3 × $0.005) | $0.015 | $15.00 | $450 |
| Upstash rate limit | $0.0001 | $0.10 | $3 |
| Cloudflare Turnstile | free | free | free |
| **Total per guest query** | **~$0.023** | | |
| **Monthly cost (1,000/day)** | | | **~$678** |

If 10% of guests convert at $0/month (free tier), LTV is from upsell to Pro at $5/month later. **At 10% conversion, we need 100 paying users / month per 1,000 daily guests to break even at $5 ARPU.** That's a $5 Pro plan assumption, conservative.

---

## 4. Risks & open questions

### 4.1 WhatsApp OTP
- **Twilio Verify WhatsApp access is "pilot phase, contact sales" in some regions.** Risk: 2-4 week sales cycle to enable. **Action:** file the Twilio support ticket in week 1 of the sprint.
- **Meta template approval takes 24-72h.** Plan the 2 templates (`bokari_authentication_v1` and `bokari_authentication_sms_fallback_v1`) before sprint start.
- **Country code detection is best-effort.** A user in Paris on vacation will get `+33` even if they want `+223`. Solution: always show the country selector, never auto-hide.
- **Authentication-international trap for Nigeria.** If Bokari registers the WABA in Senegal, all Nigeria auths cost $0.0067 domestic (good) — but if registered in EU/US, Nigeria auths cost $0.075 (12x). **Action: register WABAs in Bokari's launch markets (SN, CI, ML, BF) before going live in Nigeria, or accept the premium.**
- **No current WhatsApp fallback plan if Twilio has an outage.** Twilio has had multi-hour WhatsApp outages in 2024-2025. **Action:** add a `try { channel: 'whatsapp' } catch { channel: 'sms' }` fallback in the server action.
- **Supabase Auth Hook not configurable in the Bokari plan.** Self-hosted Supabase supports the Send SMS Hook, but cloud Supabase (which Bokari is on) does not. If we need Termii/Africa's Talking in a future sprint, we need a different auth approach.

### 4.2 Persistent session
- **Default behavior is correct — do not change JWT expiry** unless we hit a specific security need.
- **Verify the proxy.ts is in place.** This is the single most common cause of "user gets randomly logged out." Audit by reading the current proxy.ts.
- **iOS Safari 16.4+ now ships 7-day localStorage cap** (policies may apply). Use cookies (via @supabase/ssr) — already correct.
- **The 70% AI traffic without referer header is a known measurement issue** (per [DirJournal 2026](https://www.dirjournal.com/blogs/chatgpt-vs-perplexity-vs-gemini-conversions)). Not directly relevant for sessions, but relevant for measuring guest→signup attribution.

### 4.3 Guest mode
- **The blurred text is still in the DOM.** A determined user can DevTools and read it. This is acceptable for a free-tier teaser — the conversion intent is "I want this every day," not "I want to read this one answer."
- **Server-side bot detection is needed** beyond Turnstile. We should add a basic heuristic: if 5+ queries from the same `_bk_anon` in 60 seconds, hard-block the IP.
- **Cache the LLM response for 24h** so the same guest query returns the same text (cache key = `query + sources_hash`). This both reduces cost and lets the user feel "I already got value."
- **Conversion attribution is hard.** Use a `?ref=guest_blur` URL param to know which guest queries converted. Store the original query (hashed) in the user's profile for cohort analysis.
- **GDPR/African data laws apply to the guest too.** The `_bk_anon` cookie is a tracker under GDPR. We need a consent banner if any EU user might hit Bokari. For Sprint 4, geofence the EU out (or add a basic consent banner) — Africa's local laws are less strict for now.

### 4.4 Open questions for Soundiata / Ousmane to decide

1. **Sprint 4 scope: WhatsApp only, or WhatsApp + email/password (current)?** The current email/password flow should stay as a fallback; but the question is whether the default landing is "Continue with WhatsApp" or "Continue with email."
2. **Guest query cap: 3 per 24h (recommended) or 5/24h or 1/24h?** Lower = more aggressive conversion push, but worse UX for legit research sessions.
3. **WABA registration strategy:** register in Senegal only (cheapest) or in SN + CI + ML + BF (4× the $85 Africa's Talking setup fee but unlocks domestic auth rates)?
4. **Twilio Verify vs direct Meta + custom OTP?** Verify = $0.05/verification overhead. At 1K signups/day, that's $1,500/month in pure overhead. Worth it for Sprint 4 (simplicity), revisit at scale.
5. **Soft blur (overlay) vs. hard cap (stop before LLM)?** Soft = better UX, 3× LLM cost. Hard = saves money, worse conversion. Recommend soft.
6. **Should the response `text` be the only thing blurred, or should the chart be blurred too?** Charts are cheap (small data); the LLM text is the valuable IP. Blur only the text.

---

## 5. Sources & references

### WhatsApp OTP pricing & providers (2026)
- [Meta WhatsApp pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) — official rate card, April 2026
- [whautomate.com WhatsApp pricing](https://whautomate.com/whatsapp-business-api-pricing) — per-country detail, Auth-International trap
- [arkesel.com 2026 OTP comparison](https://arkesel.com/otp-api-providers-comparison-2026/) — Twilio vs Vonage vs Plivo vs Africa's Talking vs Termii vs Arkesel
- [apiscout.dev 2026 WhatsApp API](https://apiscout.dev/guides/best-whatsapp-business-apis-2026) — BSP comparison, 360dialog break-even at 10K msgs/month
- [Twilio WhatsApp pricing](https://www.twilio.com/en-us/whatsapp/pricing) — $0.005/msg markup
- [Twilio Verify pricing](https://www.twilio.com/en-us/verify/pricing) — $0.05/verification
- [Twilio Verify WhatsApp docs](https://www.twilio.com/docs/verify/whatsapp) — "Pilot phase, contact sales"
- [Africa's Talking WhatsApp](https://africastalking.com/chat/whatsapp) — $0.008 auth Rest of Africa
- [Termii pricing](https://termii.com/pricing) — Nigeria WhatsApp $0.0566
- [Termii WhatsApp OTP API](https://developer.termii.com/send-whatsapp-token)
- [Kolonell Senegal pricing](https://kolonell.com/en/blog/whatsapp-business-api-meta-pricing-senegal-2026) — Senegal-specific
- [Authgear SMS vs WhatsApp 2026](https://www.authgear.com/post/sms-otp-vs-whatsapp-otp/) — 219-country savings analysis
- [Blueticks 2026 WhatsApp pricing](https://blueticks.co/blog/whatsapp-business-api-pricing-2026) — Jan 2026 rate adjustment

### Open-source WhatsApp (not recommended for production)
- [Baileys introduction](https://baileys.wiki/docs/intro/) — official disclaimer
- [Baileys npm](https://www.npmjs.com/package/baileys) — @whiskeysockets/baileys v7.0.0-rc
- [whatsapp-web.js guide](https://wwebjs.dev/guide/) — ToS risk documentation
- [DEV community Baileys production guide](https://dev.to/naveen_gaur/the-complete-developers-guide-to-the-baileys-whatsapp-bot-setup-scaling-and-vps-deployment-1cp3) — bans, rate limits
- [DEV community Achek](https://dev.to/calebosky/i-built-a-whatsapp-otp-ai-chatbot-platform-for-african-businesses-4b4h) — African use case, session management pain

### Supabase Auth phone
- [Supabase phone login docs](https://supabase.com/docs/guides/auth/phone-login) — WhatsApp via Twilio/Twilio Verify only
- [Supabase Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook) — LatAm example to lift for Africa
- [Supabase MFA phone](https://supabase.com/docs/guides/auth/auth-mfa/phone) — 5-min code validity
- [Supabase self-hosted phone config](https://supabase.com/docs/guides/self-hosting/self-hosted-phone-mfa) — `SMS_OTP_EXP=300` recommendation
- [Supabase auth-js PR #33135](https://github.com/supabase/supabase/pull/33135) — "whatsapp is only supported for Twilio and Twilio Verify"
- [DeepWiki SMS provider integration](https://deepwiki.com/supabase/auth/7.2-sms-provider-integration) — `IsValidMessageChannel` source

### React phone input libraries
- [react-international-phone](https://github.com/ybrusentsov/react-international-phone) — v4.8.0 Feb 2026, MIT, 180K weekly DLs
- [react-phone-number-input](https://github.com/catamphetamine/react-phone-number-input) — v3.4.17 May 2026, MIT, 2.1M weekly DLs
- [npm-compare](https://npm-compare.com/react-international-phone,react-intl-tel-input,react-phone-input-2,react-phone-number-input) — 4-way comparison
- [Croct 2026 phone input libraries](https://blog.croct.com/post/best-react-phone-number-input-libraries)
- [uxpatterns.dev phone number pattern](https://uxpatterns.dev/patterns/forms/phone-number) — accessibility guidance
- [ecomdesignpro.com 2026 phone UX](https://ecomdesignpro.com/phone-number-field-ux/) — `type="tel"`, `inputMode="tel"`, accept flexible entry
- [shadcn country dropdown block](https://shadcn-country-dropdown.vercel.app/phone-input) — Bokari's shadcn base-nova fit

### Supabase SSR / sessions
- [@supabase/ssr GitHub](https://github.com/supabase/ssr/) — package consolidation, getAll/setAll requirement
- [Supabase server-side creating-a-client](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — official SSR pattern
- [Supabase advanced SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide) — PKCE, ISR pitfalls, cache headers
- [Supabase user sessions](https://supabase.com/docs/guides/auth/sessions) — default lifetimes
- [Supabase Next.js quickstart AI prompt](https://github.com/supabase/supabase/blob/master/examples/prompts/nextjs-supabase-auth.md) — exact cookies pattern
- [DeepWiki refresh tokens](https://deepwiki.com/supabase/auth/6.2-refresh-tokens) — V1 vs V2, 10s reuse window
- [DeepWiki session lifecycle](https://deepwiki.com/supabase/auth/6.3-session-lifecycle) — NotAfter, Timebox, Inactivity
- [RapidDev session refresh](https://www.rapidevelopers.com/supabase-tutorial/how-to-refresh-a-session-token-in-supabase) — 80% lifetime auto-refresh
- [Securie Next.js + Supabase guide](https://securie.ai/blog/how-to-add-auth-to-next-js-supabase-app) — getUser() vs getSession()
- [SecureStartKit 2026 guide](https://securestartkit.com/blog/supabase-authentication-in-next-js-app-router-the-complete-2026-guide) — `await cookies()` requirement
- [StackOverflow Next.js 16 client cookie sync](https://stackoverflow.com/questions/79864304) — known hydration issue
- [Auth-JS defaults source](https://github.com/supabase/supabase-js/blob/86fe3511ce5f6d4c7ccf85db8e9a824e4db60fb6/src/SupabaseClient.ts) — `DEFAULT_AUTH_OPTIONS`

### Guest mode / paywall
- [Perplexity free tier 14-day test](https://nexodatech.com/perplexity-ai-free-tier-an-honest-two-week-test/) — rolling 24h restoration
- [Perplexity 2026 complete guide](https://perplexityaimagazine.com/perplexity-hub/how-to-use-perplexity-ai-2/) — 5 Pro/day, Free $0
- [Perplexity free search limit 2026](https://www.aiqnahub.com/perplexity-free-search-limit-standard-mode/) — 5 Pro / 4h rolling window
- [Perplexity pricing 2026](https://techjacksolutions.com/ai-tools/perplexity/perplexity-pricing/) — every plan
- [Perplexity statistics 2026](https://wytlabs.com/blog/perplexity-ai-statistics-2026-usage-revenue/) — 5-7% free-to-Pro
- [Attrifast 200-site AI traffic benchmark 2026](https://attrifast.com/blog/ai-traffic-revenue-benchmark-2026) — 3.5× inline CTA lift
- [DirJournal 3-LLM comparison](https://www.dirjournal.com/blogs/chatgpt-vs-perplexity-vs-gemini-conversions) — 70% no-referrer caveat
- [Adapty 2026 paywall report](https://adapty.io/blog/high-performing-paywall-2026/) — soft vs hard paywall data

### Cloudflare Turnstile + rate limiting
- [Websyro Turnstile + rate limit](https://www.websyro.com/blogs/secure-form-stack-rate-limit-turnstile-honeypot-spam-detection-logging) — 2026 Next.js 16 guide
- [Websyro reCAPTCHA → Turnstile](https://www.websyro.com/blogs/replace-recaptcha-cloudflare-turnstile-nextjs-guide) — `remoteip` recommendation
- [Vibestrap Turnstile](https://docs.vibestrap.dev/growth/turnstile) — 5-min token expiry
- [Hello Kellyco Turnstile 15](https://hellokellyco.com/blog/cloudflare-turnstile-nextjs-15) — server action pattern
- [SecureStartKit server action rate limit](https://securestartkit.com/blog/how-to-rate-limit-nextjs-server-actions-before-they-get-abused) — sliding window recommendation
- [Next.js Launchpad 2026 rate limit guide](https://nextjslaunchpad.com/article/nextjs-rate-limiting-api-routes-server-actions-ai-endpoints) — per-action identifier
- [Upstash free tier 10K commands/day](https://upstash.com/docs/redis/help/faq) — 2026 limits
- [Upstash Ratelimit costs](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs) — sliding window = 2 commands/limit
- [StackNotice Upstash Next.js 2026](https://stacknotice.com/blog/nextjs-rate-limiting-upstash-2026) — $4/month at 1M reqs

### Data protection (Senegal / Côte d'Ivoire / GDPR)
- [DLA Piper Senegal](https://www.dlapiperdataprotection.com/index.html?c=SN&t=law) — Law 2008-12 + Decree 2008-721
- [Regulations.AI Senegal](https://regulations.ai/regulations/RAI-SN-NA-N2PPDXX-2008) — CDP structure
- [Financial Afrik RAPDP 2026](https://www.financialafrik.com/en/2026/05/21/ivory-coast-rapdp-2026-personal-data-governance-at-the-heart-of-the-african-digital-economy/) — Abidjan Declaration 2026-2030
- [Digital Mag CI 2025 review](https://digitalmag.ci/protection-des-donnees-a-caractere-personnel-etat-des-lieux-en-afrique-en-2025/) — CI 2013 law
- [Intelli WhatsApp + NDPA + GDPR](https://www.intelliconcierge.com/blog/is-whatsapp-business-api-gdpr-and-data-law-compliant-for-nigerian-and-kenyan-businesses) — opt-in requirement
- [Data Protection Africa](https://dataprotection.africa/) — 43 African data protection laws tracked

---

## 6. One-page summary for Soundiata

| Decision | Recommendation | Confidence | Cost impact (1K signups/day) |
|---|---|---|---|
| WhatsApp OTP provider | **Supabase Auth phone + Twilio Verify** (only path Supabase supports for WhatsApp) | High | ~$90/mo |
| SMS fallback | Add in Sprint 5 (Twilio SMS Mali ~$0.10/OTP) | High | +$150/mo when enabled |
| Country flag library | **`react-international-phone` v4.8.0** (MIT, 180K weekly DLs) | High | 0 |
| Country default detection | Cloudflare `cf-ipcountry` header in proxy.ts | High | 0 |
| OTP code length | 6 digits, 5-min validity, 30s resend cooldown | High | 0 |
| WABA registration | Senegal first (cheapest setup), add CI/ML/BF before those markets | Medium | $85 + $50/mo per country |
| Persistent session | **Leave defaults** (1h access, infinite refresh, @supabase/ssr with getAll/setAll) | High | 0 |
| Audit checklist | Verify proxy.ts exists, uses getUser() (not getSession()) | High | 0 |
| Multi-device UI | Skip for Sprint 4 | High | 0 |
| Guest mode pattern | "Show the work, hide the text" + CSS blur + WhatsApp CTA | High | +$678/mo at 1K queries/day |
| Guest query cap | 3 per 24h, sliding window, cookie-based identity | High | 0 (Upstash free tier covers) |
| Conversion target | 8-12% guest→signup within 7 days | Medium | n/a |
| Bot protection | Cloudflare Turnstile on signup page only, free tier | High | 0 |
| GDPR/CI/SN data laws | Add consent checkbox + privacy policy + 12-month retention | High | 0 |
| Open question | Twilio Verify "pilot phase" — file the access ticket in week 1 | High urgency | n/a |

**Total monthly cost for Sprint 4 at 1K signups/day + 1K guest queries/day: ~$770/mo** (90% is guest LLM calls, 10% is WhatsApp OTP). Acceptable for the conversion target.
