import { defineConfig } from 'drizzle-kit';

// Neon Postgres — parallel to drizzle.config.ts (which is SQLite-only and
// unrelated). Kept as a separate config the same way supabase/migrations/
// and drizzle/ were kept separate before this migration: two different
// databases, two different migration folders, never mixed.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/postgres/schema.ts',
  out: './drizzle-pg',
  dbCredentials: {
    url: process.env.NEON_DATABASE_URL ?? '',
  },
});
