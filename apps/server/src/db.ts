/** SQLite storage: settings (runtime source of truth) + runs history. */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type {
  CheckResultDto,
  RunError,
  RunListItem,
  RunRequest,
  RunResult,
  RunSource,
  RunState,
  RunSummary,
  VerdictType,
} from './core-types';

const DDL = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  finished_at   TEXT,
  state         TEXT NOT NULL,
  platform      TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  use_proxy     INTEGER NOT NULL DEFAULT 0,
  elapsed_ms    INTEGER,
  nickname      TEXT,
  mastery_rank  INTEGER,
  verdict       TEXT,
  error_type    TEXT,
  summary_json  TEXT,
  source_json   TEXT,
  checks_json   TEXT,
  error_json    TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs (created_at DESC);
`;

export function openDb(dbPath: string): Database.Database {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(DDL);
  return db;
}

export class SettingsStore {
  constructor(private readonly db: Database.Database) {}

  get(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value;
  }

  set(key: string, value: string): void {
    this.db
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value);
  }

  delete(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  getNumber(key: string, fallback: number): number {
    const value = Number(this.get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  getBool(key: string, fallback = false): boolean {
    const value = this.get(key);
    if (value === undefined) return fallback;
    return value === '1' || value === 'true';
  }

  /** First start: seed missing keys from .env (bootstrap only — never overwrites). */
  seedFromEnv(dotEnv: Record<string, string>): void {
    const seeds: Array<[string, string | undefined]> = [
      ['scraperapi_key', dotEnv.SCRAPERAPI_KEY],
      ['default_account_id', dotEnv.WARFRAME_ACCOUNT_ID],
    ];
    for (const [key, value] of seeds) {
      if (value && this.get(key) === undefined) this.set(key, value);
    }
  }
}

interface RunRow {
  id: string;
  created_at: string;
  finished_at: string | null;
  state: RunState;
  platform: string;
  account_id: string;
  use_proxy: number;
  elapsed_ms: number | null;
  nickname: string | null;
  mastery_rank: number | null;
  verdict: VerdictType | null;
  error_type: string | null;
  summary_json: string | null;
  source_json: string | null;
  checks_json: string | null;
  error_json: string | null;
}

const parseJson = <T>(text: string | null): T | null => {
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const toResult = (row: RunRow): RunResult => ({
  version: 2,
  id: row.id,
  state: row.state,
  verdict: row.verdict,
  request: {
    platform: row.platform as RunResult['request']['platform'],
    accountId: row.account_id,
    useProxy: Boolean(row.use_proxy),
  },
  source: parseJson<RunSource>(row.source_json),
  summary: parseJson<RunSummary>(row.summary_json),
  checks: parseJson<CheckResultDto[]>(row.checks_json) ?? [],
  error: parseJson<RunError>(row.error_json),
  createdAt: row.created_at,
  finishedAt: row.finished_at,
});

export interface RunFinishPatch {
  state: 'done' | 'failed';
  verdict: VerdictType | null;
  source: RunSource | null;
  summary: RunSummary | null;
  checks: CheckResultDto[];
  error: RunError | null;
}

export class RunsStore {
  constructor(private readonly db: Database.Database) {}

  create(id: string, request: RunRequest): void {
    this.db
      .prepare('INSERT INTO runs (id, created_at, state, platform, account_id, use_proxy) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, new Date().toISOString(), 'queued', request.platform, request.accountId, request.useProxy ? 1 : 0);
  }

  markRunning(id: string): void {
    this.db.prepare("UPDATE runs SET state = 'running' WHERE id = ?").run(id);
  }

  finish(id: string, patch: RunFinishPatch): RunResult {
    this.db
      .prepare(
        `UPDATE runs SET
           finished_at = ?, state = ?, verdict = ?, elapsed_ms = ?,
           nickname = ?, mastery_rank = ?,
           summary_json = ?, source_json = ?, checks_json = ?, error_json = ?, error_type = ?
         WHERE id = ?`,
      )
      .run(
        new Date().toISOString(),
        patch.state,
        patch.verdict,
        patch.source?.durationMs ?? null,
        patch.summary?.nickname ?? null,
        patch.summary?.masteryRank ?? null,
        patch.summary ? JSON.stringify(patch.summary) : null,
        patch.source ? JSON.stringify(patch.source) : null,
        JSON.stringify(patch.checks),
        patch.error ? JSON.stringify(patch.error) : null,
        patch.error?.type ?? null,
        id,
      );
    const result = this.get(id);
    if (!result) throw new Error(`Run ${id} disappeared after finish`);
    return result;
  }

  get(id: string): RunResult | undefined {
    const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(id) as RunRow | undefined;
    return row ? toResult(row) : undefined;
  }

  list(limit: number, offset: number): { total: number; items: RunListItem[] } {
    const total = (this.db.prepare('SELECT COUNT(*) AS n FROM runs').get() as { n: number }).n;
    const rows = this.db
      .prepare(
        `SELECT id, created_at, platform, account_id, nickname, mastery_rank, verdict, state, elapsed_ms
         FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as Array<
      Pick<
        RunRow,
        | 'id'
        | 'created_at'
        | 'platform'
        | 'account_id'
        | 'nickname'
        | 'mastery_rank'
        | 'verdict'
        | 'state'
        | 'elapsed_ms'
      >
    >;
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        platform: row.platform as RunListItem['platform'],
        accountId: row.account_id,
        nickname: row.nickname,
        masteryRank: row.mastery_rank,
        verdict: row.verdict,
        state: row.state,
        elapsedMs: row.elapsed_ms,
      })),
    };
  }
}
