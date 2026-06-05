# TODO — Kapso migration cleanup (3 juillet 2026)

## Tasks

### After 30 days of stable Kapso production (3 juillet 2026)

- [ ] **Delete `src/lib/auth/whatsapp/meta-client.ts`** (no longer used in production)
  - Safe to delete only if `WHATSAPP_PROVIDER=kapso` has been the only mode for 30 days
  - Keep git history (no force-push, no history rewrite)
  - Remove the `dual` mode path from `src/lib/auth/whatsapp/provider.ts` (no longer reachable)

- [ ] **Remove Meta fallback env vars from Vercel**
  - `META_WHATSAPP_TOKEN`
  - `META_WHATSAPP_PHONE_ID`
  - `META_WHATSAPP_WABA_ID`
  - `META_WHATSAPP_VERIFY_TOKEN`
  - Keep `META_WHATSAPP_APP_SECRET` as alias for `KAPSO_APP_SECRET` (since verifier reads both)

- [ ] **Update package.json scripts** if needed
  - Add `pnpm test:kapso` (optional convenience)

- [ ] **Archive legacy docs**
  - Move this TODO to `docs/archive/2026-07-03-kapso-cleanup.md`
  - Add note in `docs/auth/whatsapp.md` deprecation banner

### Kapso features to enable in Sprint 5+ (after cleanup)

- [ ] **Inbox for team** : enable for support team to monitor WhatsApp conversations
- [ ] **Broadcasts** : marketing campaigns to all verified users
- [ ] **WhatsApp Flows** : CSAT surveys, onboarding wizard
- [ ] **Functions** : migrate auto-titling logic to Kapso function (Cloudflare Workers)
- [ ] **Workflows** : visual automation for marketing team
- [ ] **MCP server for OpenCode** : enable OpenCode to operate Bokari's WhatsApp via MCP

## Decision log

### 2026-06-03: GO migration

- User picked: `WHATSAPP_PROVIDER=kapso` (after Free plan)
- User picked: 30 days backup duration
- Risk-free with `WHATSAPP_PROVIDER=dual` env var switch

### Why this date

30 days from now = 3 July 2026. Enough time to:
1. Verify Kapso uptime in production
2. Test all OTP flows on real users
3. Validate webhook delivery + retries
4. Confirm display name approval
5. Compare error rates vs Meta direct (baseline)

If anything goes wrong, we flip `WHATSAPP_PROVIDER=meta` in <5 seconds.
