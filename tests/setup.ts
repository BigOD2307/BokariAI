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

export function cleanupTempDataDir() {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
