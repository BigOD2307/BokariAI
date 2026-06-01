/**
 * Apply SQL migrations to the real Supabase project.
 *
 * Two paths:
 *   1. SUPABASE_ACCESS_TOKEN set → call the Supabase Management API
 *      (https://api.supabase.com/v1/projects/{ref}/database/query).
 *   2. No token → print a copy-pasteable command and exit.
 *
 * Usage:
 *   node scripts/apply-migrations.js
 *   SUPABASE_ACCESS_TOKEN=sbp_… node scripts/apply-migrations.js
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const REF = process.env.SUPABASE_PROJECT_ID || 'urwdrdobbvkenztuhcgx';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

async function viaManagementApi(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return text;
}

async function main() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  if (!fs.existsSync(dir)) {
    console.error('No migrations dir at', dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    console.log('No .sql files in', dir);
    return;
  }

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf-8');
    console.log(`\n--- ${f} (${sql.length} bytes) ---`);

    if (TOKEN) {
      try {
        const out = await viaManagementApi(sql);
        console.log('OK', out ? '· ' + out.substring(0, 200) : '');
      } catch (e) {
        console.error('FAIL', e.message);
        process.exit(1);
      }
    } else {
      console.log(`\n[no SUPABASE_ACCESS_TOKEN set] To apply manually, open:\n  https://supabase.com/dashboard/project/${REF}/sql/new\nand paste the contents of supabase/migrations/${f}\n`);
    }
  }

  if (!TOKEN) {
    console.log('\nTip: set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens) to apply automatically.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
