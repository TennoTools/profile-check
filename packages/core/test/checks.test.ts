import { describe, expect, it } from 'vitest';
import { deriveVerdict, formatDuration, type ParserLike, runCheck, validateProfile } from '../src';

const ACCOUNT_ID = '505875fb1a4d80894a000000';

/** Frozen labels — MUST match legacy/SUMMARY.md and v1 behavior exactly. */
const FROZEN_LABELS = [
  'profile.displayName is a non-empty string',
  'profile.accountId matches the requested id',
  'profile.accountId is a 24-char hex ObjectId',
  'profile.masteryRank is an integer >= 0',
  'profile.created is a valid Date',
  'profile.loadout is built (suits/xpInfo arrays)',
  'profile.missions is an array',
  'profile.challengeProgress is an array (Nightwave)',
  'profile.intrinsics is an object',
  'stats.timePlayedSec is a finite number',
  'stats.missionsCompleted is a number',
  'stats.weapons and stats.enemies are arrays',
  'xpCacheExpiryDate / ceremonyResetDate are parsed Dates',
];

const CRITICAL_LABELS = [
  'profile.displayName is a non-empty string',
  'profile.accountId is a 24-char hex ObjectId',
  'profile.masteryRank is an integer >= 0',
  'profile.created is a valid Date',
  'profile.loadout is built (suits/xpInfo arrays)',
  'stats.timePlayedSec is a finite number',
];

const validParser = (): ParserLike => ({
  profile: {
    displayName: 'TestTenno',
    accountId: ACCOUNT_ID,
    masteryRank: 2,
    created: new Date('2026-10-12T00:00:00.000Z'),
    loadout: { suits: [{ name: 'Volt' }], xpInfo: [], primary: [{ name: 'Burston' }] },
    missions: [],
    challengeProgress: [],
    intrinsics: {},
    guildName: 'Sons Of Bloodz#111',
    guildTier: 3,
    guildClass: 10,
    unlockedOperator: false,
  },
  stats: { timePlayedSec: 28560, missionsCompleted: 86, missionsFailed: 0, weapons: [], enemies: [] },
  xpCacheExpiryDate: new Date('2026-10-18T16:24:02.000Z'),
});

describe('validateProfile', () => {
  it('uses the frozen v1 labels and critical flags', () => {
    const checks = validateProfile(validParser(), ACCOUNT_ID);
    expect(checks.map((check) => check.label)).toEqual(FROZEN_LABELS);
    expect(checks.filter((check) => check.critical).map((check) => check.label)).toEqual(CRITICAL_LABELS);
  });

  it('passes every check on a healthy parsed profile', () => {
    const checks = validateProfile(validParser(), ACCOUNT_ID);
    expect(checks.every((check) => check.ok)).toBe(true);
    expect(deriveVerdict(checks)).toBe('ok');
  });

  it('fails the displayName check on an empty name (critical)', () => {
    const parser = validParser();
    const profile = parser.profile as NonNullable<ParserLike['profile']>;
    profile.displayName = '   ';
    const checks = validateProfile(parser, ACCOUNT_ID);
    const failed = checks.find((check) => check.label === FROZEN_LABELS[0]);
    expect(failed?.ok).toBe(false);
    expect(failed?.critical).toBe(true);
    expect(deriveVerdict(checks)).toBe('broken');
  });

  it('fails the accountId match on a different id (non-critical → warnings)', () => {
    const parser = validParser();
    const profile = parser.profile as NonNullable<ParserLike['profile']>;
    profile.accountId = '515d0a861a4d80bc14000020';
    const checks = validateProfile(parser, ACCOUNT_ID);
    const failed = checks.find((check) => check.label === FROZEN_LABELS[1]);
    expect(failed?.ok).toBe(false);
    expect(failed?.critical).toBe(false);
    expect(deriveVerdict(checks)).toBe('warnings');
  });

  it('fails masteryRank, created, loadout and timePlayedSec on garbage values (critical)', () => {
    const parser = validParser();
    const profile = parser.profile as NonNullable<ParserLike['profile']>;
    const stats = parser.stats as NonNullable<ParserLike['stats']>;
    profile.masteryRank = -1;
    profile.created = 'not-a-date';
    (profile as Record<string, unknown>).loadout = { suits: 'nope' };
    stats.timePlayedSec = 'many';
    const checks = validateProfile(parser, ACCOUNT_ID);
    for (const label of [FROZEN_LABELS[3], FROZEN_LABELS[4], FROZEN_LABELS[5], FROZEN_LABELS[9]]) {
      expect(checks.find((check) => check.label === label)?.ok, label).toBe(false);
    }
    expect(deriveVerdict(checks)).toBe('broken');
  });

  it('fails the expiry-date check when both dates are missing (non-critical)', () => {
    const parser = validParser();
    parser.xpCacheExpiryDate = undefined;
    parser.ceremonyResetDate = undefined;
    const checks = validateProfile(parser, ACCOUNT_ID);
    const failed = checks.find((check) => check.label === FROZEN_LABELS[12]);
    expect(failed?.ok).toBe(false);
    expect(failed?.critical).toBe(false);
    expect(deriveVerdict(checks)).toBe('warnings');
  });
});

describe('runCheck', () => {
  it('turns thrown errors into failed checks instead of crashing', () => {
    const result = runCheck('boom', true, () => {
      throw new Error('kaboom');
    });
    expect(result).toEqual({ label: 'boom', critical: true, ok: false, detail: 'kaboom' });
  });
});

describe('formatDuration', () => {
  it('formats like v1', () => {
    expect(formatDuration(28560)).toBe('7 h 56 min');
    expect(formatDuration(177_450)).toBe('2 d 1 h 17 min');
    expect(formatDuration(300)).toBe('5 min');
    expect(formatDuration(undefined)).toBe('unknown');
    expect(formatDuration(-1)).toBe('unknown');
  });
});
