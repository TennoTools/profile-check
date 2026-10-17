/**
 * The 13 validation checks from v1, ported 1:1 — labels and critical flags are
 * frozen: `legacy/SUMMARY.md` documents them and tests assert them.
 */

import { HEX24 } from './account-id';
import { dateFormat, formatDuration, isDate, numberFormat } from './format';

export interface CheckResult {
  label: string;
  critical: boolean;
  ok: boolean;
  detail: string;
}

interface LoadoutEntryLike {
  name?: unknown;
  uniqueName?: unknown;
}

interface LoadoutLike {
  suits?: Array<LoadoutEntryLike>;
  xpInfo?: unknown;
  primary?: Array<LoadoutEntryLike>;
  secondary?: Array<LoadoutEntryLike>;
  melee?: Array<LoadoutEntryLike>;
}

export interface ProfileLike {
  displayName?: unknown;
  accountId?: unknown;
  masteryRank?: unknown;
  created?: unknown;
  loadout?: LoadoutLike;
  missions?: unknown;
  challengeProgress?: unknown;
  intrinsics?: unknown;
  guildName?: unknown;
  guildTier?: unknown;
  guildClass?: unknown;
  unlockedOperator?: unknown;
}

export interface StatsLike {
  timePlayedSec?: unknown;
  missionsCompleted?: unknown;
  missionsFailed?: unknown;
  weapons?: unknown;
  enemies?: unknown;
}

/** Structural shape shared by the real parser and test doubles. */
export interface ParserLike {
  profile?: ProfileLike;
  stats?: StatsLike;
  xpCacheExpiryDate?: unknown;
  ceremonyResetDate?: unknown;
}

interface CheckOutcome {
  ok: boolean;
  detail: string;
}

export function runCheck(label: string, critical: boolean, fn: () => CheckOutcome): CheckResult {
  try {
    const { ok, detail = '' } = fn();
    return { label, critical, ok: Boolean(ok), detail };
  } catch (error) {
    return { label, critical, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

export function validateProfile(parser: ParserLike, requestedId: string): CheckResult[] {
  const profile = parser.profile ?? {};
  const stats = parser.stats ?? {};
  const id = requestedId.toLowerCase();
  const result = (ok: boolean, passDetail: string, failDetail: string = passDetail): CheckOutcome => ({
    ok,
    detail: ok ? passDetail : failDetail,
  });
  const list = (value: unknown): string =>
    Array.isArray(value) ? `${numberFormat.format(value.length)} entries` : 'not an array';

  const checks: Array<[string, boolean, () => CheckOutcome]> = [
    [
      'profile.displayName is a non-empty string',
      true,
      () =>
        result(
          typeof profile.displayName === 'string' && profile.displayName.trim() !== '',
          `"${String(profile.displayName)}"`,
          'missing or empty',
        ),
    ],
    [
      'profile.accountId matches the requested id',
      false,
      () =>
        result(String(profile.accountId).toLowerCase() === id, '', `requested ${id}, got ${String(profile.accountId)}`),
    ],
    [
      'profile.accountId is a 24-char hex ObjectId',
      true,
      () =>
        result(
          HEX24.test(String(profile.accountId ?? '')),
          String(profile.accountId),
          `got ${JSON.stringify(profile.accountId)}`,
        ),
    ],
    [
      'profile.masteryRank is an integer >= 0',
      true,
      () =>
        result(
          Number.isInteger(profile.masteryRank) && (profile.masteryRank as number) >= 0,
          `MR ${String(profile.masteryRank)}`,
          `got ${JSON.stringify(profile.masteryRank)}`,
        ),
    ],
    [
      'profile.created is a valid Date',
      true,
      () =>
        result(
          isDate(profile.created),
          isDate(profile.created) ? dateFormat.format(profile.created) : '',
          `got ${JSON.stringify(profile.created)}`,
        ),
    ],
    [
      'profile.loadout is built (suits/xpInfo arrays)',
      true,
      () =>
        result(
          Array.isArray(profile.loadout?.suits) && Array.isArray(profile.loadout?.xpInfo),
          `frame: ${String(profile.loadout?.suits?.[0]?.name ?? '?')}`,
          'missing or malformed',
        ),
    ],
    ['profile.missions is an array', false, () => result(Array.isArray(profile.missions), list(profile.missions))],
    [
      'profile.challengeProgress is an array (Nightwave)',
      false,
      () => result(Array.isArray(profile.challengeProgress), list(profile.challengeProgress)),
    ],
    [
      'profile.intrinsics is an object',
      false,
      () => result(typeof profile.intrinsics === 'object' && profile.intrinsics !== null, '', 'missing'),
    ],
    [
      'stats.timePlayedSec is a finite number',
      true,
      () =>
        result(
          Number.isFinite(stats.timePlayedSec) && (stats.timePlayedSec as number) >= 0,
          formatDuration(stats.timePlayedSec),
          `got ${JSON.stringify(stats.timePlayedSec)}`,
        ),
    ],
    [
      'stats.missionsCompleted is a number',
      false,
      () =>
        result(
          Number.isFinite(stats.missionsCompleted),
          Number.isFinite(stats.missionsCompleted) ? numberFormat.format(stats.missionsCompleted as number) : 'missing',
          'missing',
        ),
    ],
    [
      'stats.weapons and stats.enemies are arrays',
      false,
      () =>
        result(
          Array.isArray(stats.weapons) && Array.isArray(stats.enemies),
          `${(stats.weapons as unknown[] | undefined)?.length ?? 0} weapons, ${(stats.enemies as unknown[] | undefined)?.length ?? 0} enemies`,
          'not arrays',
        ),
    ],
    [
      'xpCacheExpiryDate / ceremonyResetDate are parsed Dates',
      false,
      () =>
        result(
          isDate(parser.xpCacheExpiryDate) || isDate(parser.ceremonyResetDate),
          `XpCacheExpiryDate: ${isDate(parser.xpCacheExpiryDate) ? parser.xpCacheExpiryDate.toISOString() : 'n/a'}`,
          'both invalid or missing',
        ),
    ],
  ];

  return checks.map(([label, critical, fn]) => runCheck(label, critical, fn));
}

export type Verdict = 'ok' | 'warnings' | 'broken';

/** v1 verdict mapping: critical fail → broken, non-critical fails → warnings. */
export function deriveVerdict(checks: readonly CheckResult[]): Verdict {
  const failed = checks.filter((check) => !check.ok);
  if (failed.some((check) => check.critical)) return 'broken';
  return failed.length > 0 ? 'warnings' : 'ok';
}
