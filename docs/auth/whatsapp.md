# WhatsApp OTP Authentication — Bokari

Setup guide for Bokari's WhatsApp-based signup, now powered by **Kapso** (intelligent proxy on top of Meta WhatsApp Business Cloud API).

> **Migration** : Mai 2026. We migrated from direct Meta Cloud API to Kapso. See `docs/research/2026-06-03-kapso-analysis.md` for the 200-line analysis. Same Meta cost, but unlimited extras (inbox, broadcasts, storage, flows, workflows).

## Quick start

**Local dev (no WhatsApp needed)** : all routes will return 502 with "WHATSAPP FAILED" because `KAPSO_API_KEY` is not set. Guest mode and email signup still work.

**Production** :

1. Create account on https://app.kapso.ai
2. Connect a WhatsApp number via Instant Setup (5 minutes)
3. Copy `KAPSO_API_KEY` from API & webhooks
4. Set `WHATSAPP_PROVIDER=kapso` in Vercel env
5. Configure webhook URL (see below)
6. Test with sandbox first

## Provider switching

| `WHATSAPP_PROVIDER` | Behavior | When to use |
|---------------------|----------|-------------|
| `meta` (default) | Direct Meta Cloud API via `meta-client.ts` | Legacy, kept for rollback |
| `kapso` | Via Kapso proxy (recommended) | Production |
| `dual` | Both fire, log diff, prefer first success | 30-day migration window |

## Environment variables

```bash
# Provider selection
WHATSAPP_PROVIDER=kapso              # meta | kapso | dual

# Kapso configuration (PRIMARY)
KAPSO_API_KEY=kapso_xxx                # From app.kapso.ai > API & webhooks
KAPSO_PHONE_NUMBER_ID=1234567890       # From app.kapso.ai > Connected numbers
KAPSO_APP_SECRET=abc123def              # For webhook signature verification
KAPSO_AUTH_TEMPLATE_NAME=bokari_otp     # Default, override if you renamed

# Meta fallback (for dual mode or rollback)
META_WHATSAPP_TOKEN=EAAxxxx            # System user token (legacy)
META_WHATSAPP_PHONE_ID=1234567890      # Numeric phone ID (legacy)
META_WHATSAPP_WABA_ID=0987654321        # WhatsApp Business Account ID
META_WHATSAPP_APP_SECRET=abc123         # Same secret works for both
META_WHATSAPP_VERIFY_TOKEN=random_str   # For handshake
```

The Kapso client falls back to `META_WHATSAPP_PHONE_ID` if `KAPSO_PHONE_NUMBER_ID` is missing, so the migration is non-breaking.

## Webhook configuration

### In Kapso dashboard

1. Go to **API & webhooks** > **WhatsApp webhooks** (per phone number)
2. Create webhook with URL: `https://bokari.ai/api/auth/whatsapp/webhook`
3. Subscribe to events: `whatsapp.message.delivered`, `whatsapp.message.read`, `whatsapp.message.failed`
4. Copy the auto-generated secret key into `KAPSO_APP_SECRET`

### Signature verification

The route accepts both formats:
- `X-Hub-Signature-256: sha256=...` (Meta format, primary)
- `X-Webhook-Signature: sha256=...` (Kapso format, fallback)

Both use HMAC-SHA256 over the raw request body. See `src/lib/auth/whatsapp/provider.ts` for the unified verifier.

### Retry policy (free with Kapso)

- Initial retry: 10s
- 2nd retry: 40s
- 3rd retry: 90s
- Total: ~2.5 minutes
- After max retries: batched messages fall back to individual delivery
- `X-Idempotency-Key` header included for deduplication

## OTP templates

Bokari uses a single `bokari_otp` template with category `AUTHENTICATION`. The template must be submitted to Meta and approved (24-72h).

### Template body (fixed by Meta)

```
*{{1}}* is your verification code.
```

### Template components

- BODY: `add_security_recommendation: true`
- FOOTER: `code_expiration_minutes: 10`
- BUTTONS: `[{ type: 'OTP', otp_type: 'COPY_CODE' }]`

### How Bokari sends the OTP

```typescript
await client.messages.sendTemplate({
  phoneNumberId: '1234567890',
  to: '+22370000000',
  template: {
    name: 'bokari_otp',
    language: { code: 'fr' },
    components: [
      { type: 'body', parameters: [{ type: 'text', text: '123456' }] },
      { type: 'button', sub_type: 'otp', index: '0', parameters: [{ type: 'text', text: '123456' }] },
    ],
  },
});
```

## Cost (June 2026)

| Country | Auth template rate (per delivered message) |
|---------|----------------------------------------------|
| Mali, Senegal, CI, BF, CM, DRC, rest of Africa | $0.004 |
| Nigeria | $0.0067 |
| France | $0.0248 |

**At 10k signups/day (Rest of Africa)** : $1,460/month in Meta fees.

**To avoid Auth-International premium** : register WABAs in each launch country. The premium is 3-5x if your WABA is in a different country than the recipient.

## Rate limits (Bokari enforced)

| Limit | Value | Source |
|-------|-------|--------|
| OTPs per phone per hour | 5 | `otp-store.ts` |
| OTPs per IP per hour | 30 | `/api/auth/whatsapp/start` |
| Resend cooldown | 30s | `/api/auth/whatsapp/start` |
| OTP TTL | 5 min (300s) | `otp-store.ts` |
| Max attempts per OTP | 3 | `otp-store.ts` |

## Error mapping

| Kapso/Meta error | Bokari response | UX |
|------------------|-----------------|-----|
| 429 rate limit | 429 RATE_LIMITED | "Trop d'envois. Réessaie plus tard." |
| 400 invalid template | 502 WHATSAPP_FAILED | "Impossible d'envoyer. Réessaie." |
| Network timeout | 502 WHATSAPP_FAILED | "Problème réseau. Réessaie." |
| 401 invalid token | 503 service down | "Service indisponible." (admin alert) |
| Provider config missing | 502 WHATSAPP_FAILED + `provider: 'kapso'` | Logged for ops |

## GDPR + data retention

- OTPs are stored hashed (bcrypt, 10 rounds) in SQLite — never in clear text
- OTP records are purged 24h after `verified_at` or `expires_at` (whichever is later)
- Phone numbers in `users.phoneWhatsapp` are retained for the lifetime of the account
- User can request deletion via the standard Supabase user deletion flow
- Kapso webhook logs (delivery status) are kept 30 days for debugging

## Migration from Meta direct (May-June 2026)

### What changed

| Before (Meta direct) | After (Kapso via `provider.ts`) |
|---------------------|----------------------------------|
| `meta-client.ts` (152 LOC) | `kapso-client.ts` (180 LOC) + `provider.ts` (130 LOC) |
| Manual HMAC verify | Unified verifier, accepts both Meta + Kapso formats |
| Custom retry logic | Kapso's built-in 10s/40s/90s + idempotency |
| No message history | Kapso storage of all conversations/messages |
| No team inbox | Kapso dashboard (free with any plan) |
| Manual display name approval | Kapso API with polling |

### How to roll back to Meta direct

```bash
WHATSAPP_PROVIDER=meta
```

That's it. The provider module reads the env var on every request, so no restart needed. Code paths for both providers are kept in git for 30 days post-migration (cleanup date: 3 July 2026).

## Files

```
src/lib/auth/whatsapp/
├── meta-client.ts              # Legacy direct Meta Graph API
├── kapso-client.ts             # NEW: Kapso SDK wrapper
├── provider.ts                 # NEW: unified router (WHATSAPP_PROVIDER switch)
├── otp-store.ts                # bcrypt OTP storage (unchanged)
└── jwt.ts                      # Session mint (unchanged)

src/app/api/auth/whatsapp/
├── start/route.ts              # Updated to use provider.ts
├── verify/route.ts             # Unchanged
└── webhook/route.ts            # Updated to use provider verifier

docs/auth/whatsapp.md           # This file
```

## Production checklist

- [ ] Kapso account created
- [ ] WhatsApp number connected via Instant Setup (or BYO SIM / Twilio)
- [ ] `bokari_otp` template submitted + approved
- [ ] `KAPSO_API_KEY` set in Vercel
- [ ] `KAPSO_PHONE_NUMBER_ID` set in Vercel
- [ ] `KAPSO_APP_SECRET` set in Vercel
- [ ] `WHATSAPP_PROVIDER=kapso` set in Vercel
- [ ] Webhook URL configured in Kapso dashboard
- [ ] Webhook events subscribed: `message.delivered`, `message.read`, `message.failed`
- [ ] End-to-end test passed
- [ ] Monitoring alerts on `WHATSAPP_FAILED` spike
- [ ] Rollback plan documented (flip `WHATSAPP_PROVIDER=meta`)

## Troubleshooting

### "KapsoConfigError: KAPSO_API_KEY must be set"
- The env var is missing in the runtime environment
- In Vercel: Project Settings > Environment Variables

### "Template rejected by Meta (400)"
- Template name doesn't match exactly in Kapso dashboard
- Template not approved yet
- Phone number not registered in WABA
- Check Kapso's WhatsApp Manager for status

### Webhook returns 401 INVALID_SIGNATURE
- `KAPSO_APP_SECRET` doesn't match Kapso's secret
- Or the raw body is being parsed/modified before signature check (it shouldn't be)

### OTP not received
- Check user has WhatsApp installed (not just SMS)
- Verify country code in phone number (E.164 format)
- Check Kapso dashboard > Messages for delivery status
- If using sandbox, check the sandbox number is configured
