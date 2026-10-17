/** Turns a parsed profile into the transport-friendly summary used by the API, DB and GUI. */

import type { ParserLike } from './checks';
import { isDate } from './format';
import type { RunSummary } from './schemas';

const scalar = (value: unknown): string | number | null =>
  typeof value === 'string' || typeof value === 'number' ? value : null;

export function summaryView(parser: ParserLike): RunSummary {
  const profile = parser.profile ?? {};
  const stats = parser.stats ?? {};
  const loadout = profile.loadout ?? {};
  const item = (entry?: { name?: unknown; uniqueName?: unknown }): string | null => {
    const value = entry?.name ?? entry?.uniqueName;
    return typeof value === 'string' ? value : null;
  };

  return {
    nickname: typeof profile.displayName === 'string' ? profile.displayName : null,
    accountId: typeof profile.accountId === 'string' ? profile.accountId : null,
    masteryRank: Number.isInteger(profile.masteryRank) ? (profile.masteryRank as number) : null,
    created: isDate(profile.created) ? profile.created.toISOString() : null,
    timePlayedSec: Number.isFinite(stats.timePlayedSec) ? (stats.timePlayedSec as number) : null,
    missions: {
      completed: Number.isFinite(stats.missionsCompleted) ? (stats.missionsCompleted as number) : 0,
      failed: Number.isFinite(stats.missionsFailed) ? (stats.missionsFailed as number) : 0,
    },
    clan:
      typeof profile.guildName === 'string' && profile.guildName !== ''
        ? { name: profile.guildName, tier: scalar(profile.guildTier), class: scalar(profile.guildClass) }
        : null,
    operatorUnlocked: Boolean(profile.unlockedOperator),
    loadout: {
      warframe: item(loadout.suits?.[0]),
      primary: item(loadout.primary?.[0]),
      secondary: item(loadout.secondary?.[0]),
      melee: item(loadout.melee?.[0]),
    },
    xpCacheExpiryDate: isDate(parser.xpCacheExpiryDate) ? parser.xpCacheExpiryDate.toISOString() : null,
  };
}
