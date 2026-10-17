/**
 * Consolidate the SQLite WAL into data/app.sqlite so the file is self-contained
 * and readable by any SQLite viewer. Safe to run while the server is up.
 *
 *   npm run db:checkpoint
 *
 * Reminder: the settings table holds the ScraperAPI key in clear text — never
 * upload the database to an online viewer.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const root = fileURLToPath(new URL('..', import.meta.url));
const dbPath = process.env.TENNOTOOLS_DB_PATH ?? join(root, 'data', 'app.sqlite');

if (!existsSync(dbPath)) {
  console.error(`✗ No database at ${dbPath} — run the server or a check once first.`);
  process.exit(1);
}

const db = new Database(dbPath);
try {
  const row = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as
    | { busy: number; log: number; checkpointed: number }
    | undefined;
  if (row && row.busy !== 0) {
    console.error('⚠ A write was in progress — re-run in a moment.');
    process.exitCode = 1;
  } else {
    console.log(`✓ WAL checkpointed into ${dbPath} — the file is now self-contained.`);
  }
} finally {
  db.close();
}
