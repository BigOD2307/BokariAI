/**
 * Real Postgres client (data persistence). Neon, not Supabase — see
 * `src/lib/db/postgres/compat.ts` for why this keeps the Supabase-shaped
 * `.from().select()...`/`.rpc()` chain instead of Drizzle syntax: it lets
 * every one of this module's ~7 call sites (the chat write path, quota
 * enforcement, chat ownership) keep working unchanged.
 *
 * SQLite (src/lib/db/sqlite.ts) is reserved for tests and local ephemeral
 * caches — unrelated to this file.
 */
import { createCompatClient } from './postgres/compat';
import { pool } from './postgres/client';

const supabase = createCompatClient(pool);

export default supabase;
