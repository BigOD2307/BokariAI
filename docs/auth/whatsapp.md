# WhatsApp OTP Authentication

Setup guide for Bokari's WhatsApp-based signup using Meta WhatsApp Business Cloud API directly (no Twilio dependency).

## Cost (April 2026 Meta rate card)

| Country | Auth template rate |
|---------|-------------------|
| Rest of Africa (Mali, Senegal, CI, BF, Cameroon, DRC, etc.) | $0.004 / message |
| Nigeria | $0.0067 / message |
| South Africa | $0.0076 / message |
| France | $0.0248 / message |
| **Auth-International trap** (WABA registered in wrong country) | 3-5x premium |

> To avoid the Auth-International premium, register a WABA **in each launch country** (ML, SN, CI, etc.) or in the closest regional hub.

## One-time setup

### 1. Facebook Business verification (1-3 days)

1. Create or log into a Facebook Business account at https://business.facebook.com
2. Complete business verification (legal name, address, phone, utility bill)
3. Submit for review (typically 1-3 business days)

### 2. WhatsApp Business Account (WABA)

1. In Meta Business Suite → Settings → Accounts → WhatsApp accounts
2. Click "Add" → "Create a new WhatsApp Business Account"
3. Fill in business name, timezone, category

### 3. Phone number registration

- Use a dedicated phone number (cannot be on personal WhatsApp)
- Recommended: register a number in target launch country to avoid Auth-International premium
- Meta verifies the number via SMS or voice call during setup

### 4. Submit OTP template

Template name: `bokari_otp` (configurable via `META_WHATSAPP_TEMPLATE_NAME`)

Template body:
```
Code Bokari: {{1}}

Ce code expire dans 5 minutes.
```

Optional button (URL with copy code):
```
Copy code: {{1}}
```
Type: URL, URL: `https://bokari.ai/verify?code={{1}}`

Template category: **Authentication**
Language: French (or multi-language variants)
Status: Pending (24-72h approval)

### 5. Environment variables

Add to `.env.local`:
```bash
META_WHATSAPP_TOKEN="EAAxxxxxxxxxxxxxxx"     # Permanent system user token
META_WHATSAPP_PHONE_ID="123456789012345"     # Numeric phone ID
META_WHATSAPP_WABA_ID="987654321098765"      # WhatsApp Business Account ID
META_WHATSAPP_TEMPLATE_NAME="bokari_otp"     # Default, override if different
META_WHATSAPP_APP_SECRET="abc123..."         # For webhook signature verification
META_WHATSAPP_VERIFY_TOKEN="random_string"   # For webhook subscription handshake
```

### 6. Webhook setup

Callback URL: `https://bokari.ai/api/auth/whatsapp/webhook`
Verify token: same as `META_WHATSAPP_VERIFY_TOKEN`
Subscribe to: `messages`, `message_deliveries`, `message_reads`

## Testing

### With Meta test number

In Meta Business Suite → WhatsApp → API Setup, use the test phone number to send templates without going through approval. Add your test phone to "To phone numbers" whitelist.

### Manual test flow

1. Open Bokari in browser, click "S'inscrire"
2. Choose WhatsApp tab
3. Select country, enter phone
4. Receive WhatsApp message with 6-digit code
5. Enter code, expect successful signup

## Rate limits

| Limit | Value | Source |
|-------|-------|--------|
| OTPs per phone per hour | 5 | Enforced in `otp-store.ts` |
| OTPs per IP per hour | 30 | Enforced in `/api/auth/whatsapp/start` |
| Resend cooldown | 30s | Enforced in `/api/auth/whatsapp/start` |
| OTP TTL | 5 min (300s) | Configurable, default 300 |
| Max attempts per OTP | 3 | After 3 failures, OTP is dead |

## Error mapping

| Meta error | Bokari response | UX |
|------------|-----------------|-----|
| 429 rate limit | 429 RATE_LIMITED | "Trop d'envois. Réessaie dans 1h." |
| 400 invalid template | 502 WHATSAPP_FAILED | "Impossible d'envoyer. Réessaie." |
| Network timeout | 502 WHATSAPP_FAILED | "Problème réseau. Réessaie." |
| 401 invalid token | 503 service down | "Service momentanément indisponible." (admin alert) |

## GDPR + data retention

- OTPs are stored hashed (bcrypt, 10 rounds) — never in clear text
- OTP records are purged 24h after `verified_at` or `expires_at` (whichever is later)
- Phone numbers in `users.phoneWhatsapp` are retained for the lifetime of the account
- User can request deletion via the standard Supabase user deletion flow
- Webhook logs (delivery status) are kept 30 days for debugging

## Files touched by this feature

```
src/lib/auth/whatsapp/meta-client.ts        # Graph API client
src/lib/auth/whatsapp/otp-store.ts          # bcrypt + SQLite storage
src/lib/auth/whatsapp/jwt.ts                # Session mint
src/lib/auth/country.ts                     # Default country
src/proxy.ts                                # cf-ipcountry -> cookie
src/lib/db/schema.ts                        # phoneOtps, guestSessions, users.phoneWhatsapp
src/lib/auth/guest.ts                       # Guest session + rate limit
src/lib/auth/rate-limit.ts                  # Sliding window
src/app/api/auth/whatsapp/start/route.ts    # POST: send OTP
src/app/api/auth/whatsapp/verify/route.ts   # POST: verify OTP + mint session
src/app/api/auth/whatsapp/webhook/route.ts  # GET (verify) + POST (status)
src/app/api/guest/track/route.ts            # GET/POST: track guest queries
src/app/api/turnstile/verify/route.ts       # POST: Cloudflare Turnstile
src/lib/hooks/useAuth.tsx                   # signInWithWhatsApp, verifyWhatsAppOtp, useGuestSession
```

## Production checklist

- [ ] Facebook Business verified
- [ ] WABA created in each launch country (or regional hub)
- [ ] Phone number registered
- [ ] `bokari_otp` template approved
- [ ] All env vars set in production
- [ ] Webhook URL configured and verified
- [ ] Test number added to whitelist
- [ ] End-to-end test passed
- [ ] Monitoring alerts on `WHATSAPP_FAILED` spike
- [ ] Rate limit dashboards in PostHog

## Troubleshooting

### "META_WHATSAPP_TOKEN must be set"
- The env var is missing in the runtime environment
- In Vercel: Project Settings → Environment Variables

### "Template rejected by Meta (400)"
- Template name doesn't match exactly
- Template not approved yet
- Phone number not registered in WABA

### "Network error reaching Meta"
- Meta API is down or rate limited
- Vercel function can't reach external HTTPS (rare)
- Check https://status.fb.com

### Webhook returns 401 INVALID_SIGNATURE
- `META_WHATSAPP_APP_SECRET` doesn't match Meta's app secret
- Or the raw body is being parsed/modified before signature check (it shouldn't be)
