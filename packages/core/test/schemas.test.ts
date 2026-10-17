import { describe, expect, it } from 'vitest';
import { accountIdSchema, runRequestSchema, runResultSchema, settingsUpdateSchema } from '../src';

const ACCOUNT_ID = '505875fb1a4d80894a000000';

const sampleRun = {
  version: 2 as const,
  id: 'run_abc',
  state: 'done' as const,
  verdict: 'ok' as const,
  request: { platform: 'pc' as const, accountId: ACCOUNT_ID, useProxy: false },
  source: {
    url: 'https://api.warframe.com/cdn/getProfileViewingData.php?playerId=x',
    via: 'direct' as const,
    httpStatus: 200,
    sizeBytes: 12345,
    durationMs: 900,
    xpCacheExpiryDate: '2026-10-18T16:24:02.000Z',
  },
  summary: {
    nickname: 'TestTenno',
    accountId: ACCOUNT_ID,
    masteryRank: 2,
    created: '2026-10-12T00:00:00.000Z',
    timePlayedSec: 28560,
    missions: { completed: 86, failed: 0 },
    clan: { name: 'Sons Of Bloodz#111', tier: 3, class: 10 },
    operatorUnlocked: false,
    loadout: { warframe: 'Volt', primary: 'Burston', secondary: 'Furis', melee: 'Skana' },
    xpCacheExpiryDate: '2026-10-18T16:24:02.000Z',
  },
  checks: [{ label: 'x', critical: true, ok: true, detail: '' }],
  error: null,
  createdAt: '2026-10-17T12:00:00.000Z',
  finishedAt: '2026-10-17T12:00:01.000Z',
};

describe('runResultSchema', () => {
  it('accepts a full run result and round-trips it', () => {
    const parsed = runResultSchema.parse(sampleRun);
    expect(runResultSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('rejects an unknown verdict', () => {
    expect(runResultSchema.safeParse({ ...sampleRun, verdict: 'meh' }).success).toBe(false);
  });
});

describe('runRequestSchema', () => {
  it('lowercases the accountId and defaults useProxy to false', () => {
    const parsed = runRequestSchema.parse({ platform: 'pc', accountId: ACCOUNT_ID.toUpperCase() });
    expect(parsed.accountId).toBe(ACCOUNT_ID);
    expect(parsed.useProxy).toBe(false);
  });

  it('rejects a bad accountId or platform', () => {
    expect(runRequestSchema.safeParse({ platform: 'pc', accountId: 'nope' }).success).toBe(false);
    expect(runRequestSchema.safeParse({ platform: 'switch', accountId: ACCOUNT_ID }).success).toBe(false);
  });
});

describe('accountIdSchema', () => {
  it('rejects ids whose ObjectId timestamp predates 2012', () => {
    expect(accountIdSchema.safeParse('4e0000000000000000000000').success).toBe(false);
    expect(accountIdSchema.safeParse(ACCOUNT_ID).success).toBe(true);
  });
});

describe('settingsUpdateSchema', () => {
  it('accepts a partial update and null to clear the key', () => {
    expect(settingsUpdateSchema.safeParse({ defaultUseProxy: true }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ scraperApiKey: null }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ scraperApiKey: 'abc' }).success).toBe(true);
  });

  it('rejects empty keys and unknown fields', () => {
    expect(settingsUpdateSchema.safeParse({ scraperApiKey: '' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ nope: 1 }).success).toBe(false);
  });
});
