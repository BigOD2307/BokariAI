import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import { existsSync, readdirSync } from 'fs';
import { all, get, run, exec, upsert, transaction } from '@/lib/db/sqlite';
import { cleanupTempDataDir } from '../setup';

describe('sqlite helper', () => {
  beforeAll(() => {
    expect(process.env.DATA_DIR).toBeTruthy();
  });

  afterAll(() => {
    cleanupTempDataDir();
  });

  it('runs all migrations and creates the expected tables', async () => {
    // Trigger lazy init
    await all('SELECT 1');
    const dataDir = path.join(process.env.DATA_DIR!, 'data');
    expect(existsSync(dataDir)).toBe(true);

    const tables = await all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('chats');
    expect(tableNames).toContain('messages');
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('discover_articles');

    // 0006 drops the vestigial focusMode column
    const chatColumns = await all<{ name: string }>('PRAGMA table_info(chats)');
    const chatColumnNames = chatColumns.map((c) => c.name);
    expect(chatColumnNames).not.toContain('focusMode');
  });

  it('inserts, reads and updates rows', async () => {
    const id = `chat-${Date.now()}`;
    const r = await run(
      `INSERT INTO chats (id, userId, title, createdAt, sources, files)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'user-1', 'Hello', new Date().toISOString(), '[]', '[]'],
    );
    expect(r.changes).toBe(1);

    const fetched = await get<{ id: string; title: string }>(
      'SELECT id, title FROM chats WHERE id = ?',
      [id],
    );
    expect(fetched?.title).toBe('Hello');

    const updated = await run('UPDATE chats SET title = ? WHERE id = ?', [
      'World',
      id,
    ]);
    expect(updated.changes).toBe(1);
    const after = await get<{ title: string }>('SELECT title FROM chats WHERE id = ?', [
      id,
    ]);
    expect(after?.title).toBe('World');
  });

  it('upsert replaces by unique url', async () => {
    const url = `https://example.com/${Date.now()}`;
    await upsert(
      'discover_articles',
      [
        {
          id: 'a1',
          topic: 'tech',
          title: 'v1',
          content: 'old',
          url,
          thumbnail: null,
          domain: 'example.com',
          batch_id: 'b1',
          updated_at: new Date().toISOString(),
        },
      ],
      ['url'],
    );

    await upsert(
      'discover_articles',
      [
        {
          id: 'a2',
          topic: 'tech',
          title: 'v2',
          content: 'new',
          url,
          thumbnail: null,
          domain: 'example.com',
          batch_id: 'b2',
          updated_at: new Date().toISOString(),
        },
      ],
      ['url'],
    );

    const allRows = await all<{ id: string; title: string; content: string }>(
      'SELECT id, title, content FROM discover_articles WHERE url = ?',
      [url],
    );
    expect(allRows).toHaveLength(1);
    expect(allRows[0].title).toBe('v2');
    expect(allRows[0].content).toBe('new');
  });

  it('transaction commits on success, rolls back on failure', async () => {
    const id = `tx-${Date.now()}`;
    await transaction(async (tx) => {
      await tx.run(
        `INSERT INTO chats (id, userId, title, createdAt, sources, files)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, 'u', 'T', new Date().toISOString(), '[]', '[]'],
      );
    });
    const ok = await get('SELECT id FROM chats WHERE id = ?', [id]);
    expect(ok).toBeTruthy();

    const failingId = `tx-fail-${Date.now()}`;
    await expect(
      transaction(async (tx) => {
        await tx.run(
          `INSERT INTO chats (id, userId, title, createdAt, sources, files)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [failingId, 'u', 'T', new Date().toISOString(), '[]', '[]'],
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const gone = await get('SELECT id FROM chats WHERE id = ?', [failingId]);
    expect(gone).toBeNull();
  });

  it('exec runs raw multi-statement SQL', async () => {
    await exec(`
      CREATE TABLE _tmp_test (x INTEGER);
      INSERT INTO _tmp_test VALUES (1), (2), (3);
    `);
    const rows = await all<{ x: number }>('SELECT x FROM _tmp_test');
    expect(rows.map((r) => r.x).sort()).toEqual([1, 2, 3]);
    await exec('DROP TABLE _tmp_test');
  });
});
