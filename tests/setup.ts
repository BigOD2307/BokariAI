/**
 * Vitest global setup.
 *
 * Routes every DB and migration path to a per-test-run temp directory so
 * that the SQLite helper never touches the real `data/db.sqlite`.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const dir = mkdtempSync(path.join(tmpdir(), 'bokari-test-'));
process.env.DATA_DIR = dir;

export function cleanupTempDataDir() {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
