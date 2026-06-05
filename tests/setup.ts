/**
 * Vitest global setup.
 *
 * Routes every DB and migration path to a per-test-run temp directory so
 * that the SQLite helper never touches the real `data/db.sqlite`.
 * Stubs Supabase + Kapso + Meta env vars so the clients don't throw at import time.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const dir = mkdtempSync(path.join(tmpdir(), 'bokari-test-'));
process.env.DATA_DIR = dir;
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
process.env.META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN ?? 'test-meta-token';
process.env.META_WHATSAPP_PHONE_ID = process.env.META_WHATSAPP_PHONE_ID ?? '1234567890';
process.env.META_WHATSAPP_WABA_ID = process.env.META_WHATSAPP_WABA_ID ?? '0987654321';
process.env.META_WHATSAPP_APP_SECRET = process.env.META_WHATSAPP_APP_SECRET ?? 'test-meta-app-secret';
process.env.KAPSO_API_KEY = process.env.KAPSO_API_KEY ?? 'kapso_test_key';
process.env.KAPSO_PHONE_NUMBER_ID = process.env.KAPSO_PHONE_NUMBER_ID ?? '1234567890';
process.env.KAPSO_APP_SECRET = process.env.KAPSO_APP_SECRET ?? 'test-kapso-app-secret';
// Opt-in engine features default OFF in tests so the agent path stays prose-only
// and no extractor LLM calls fire.
process.env.BOKARI_RICH_BLOCKS_ENABLED = 'false';
// Social search: master on (so zero-config = site adapter everywhere), per-network
// providers default to the keyless "site" path, no Bright Data key/datasets.
// Tests that want Bright Data set BRIGHTDATA_* + *_SEARCH_PROVIDER=brightdata
// locally and call resetSocialProviderCache().
process.env.BOKARI_SOCIAL_SEARCH_ENABLED =
  process.env.BOKARI_SOCIAL_SEARCH_ENABLED ?? 'true';
process.env.X_SEARCH_PROVIDER = process.env.X_SEARCH_PROVIDER ?? 'site';
process.env.REDDIT_SEARCH_PROVIDER = process.env.REDDIT_SEARCH_PROVIDER ?? 'site';
process.env.LINKEDIN_SEARCH_PROVIDER =
  process.env.LINKEDIN_SEARCH_PROVIDER ?? 'site';
// YouTube: search master OFF and comprehend OFF by default so tests stay on the
// zero-config scrape path and no network/STT fires at import time. No API key,
// no managed transcript key, no Bright Data YouTube dataset. Tests that want a
// specific provider set these locally + call resetYouTubeProviderCache().
delete process.env.YOUTUBE_API_KEY;
delete process.env.YOUTUBE_SEARCH_PROVIDER;
delete process.env.TRANSCRIPT_API_KEY;
delete process.env.TRANSCRIPT_API_URL;
delete process.env.BRIGHTDATA_DS_YOUTUBE_VIDEOS;
process.env.BOKARI_YOUTUBE_SEARCH_ENABLED =
  process.env.BOKARI_YOUTUBE_SEARCH_ENABLED ?? 'false';
process.env.BOKARI_YOUTUBE_COMPREHEND_ENABLED =
  process.env.BOKARI_YOUTUBE_COMPREHEND_ENABLED ?? 'false';
process.env.BOKARI_YOUTUBE_STT_ENABLED =
  process.env.BOKARI_YOUTUBE_STT_ENABLED ?? 'false';

export function cleanupTempDataDir() {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
