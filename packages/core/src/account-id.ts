/**
 * Warframe AccountId helpers.
 *
 * AccountIds are MongoDB ObjectIds: 24 hex chars whose first 4 bytes are a unix
 * timestamp — that lets us reject random 24-hex strings from cookies/storage.
 */

export const HEX24 = /^[0-9a-f]{24}$/i;

/** Plausible account ObjectId: created between 2012-01-01 and now + 1 year. */
export function looksLikeAccountId(value: unknown): value is string {
  if (typeof value !== 'string' || !HEX24.test(value)) return false;
  const seconds = Number.parseInt(value.slice(0, 8), 16);
  return seconds >= Date.UTC(2012, 0, 1) / 1000 && seconds <= Date.now() / 1000 + 366 * 24 * 3600;
}

export type AccountIdSource = 'gid' | 'cookie' | 'storage';

export interface AccountIdCandidate {
  id: string;
  source: AccountIdSource;
}

export interface CookieLike {
  name: string;
  domain: string;
  value: string;
}

const PRIORITY: Record<AccountIdSource, number> = { gid: 0, cookie: 1, storage: 2 };

/**
 * Extract plausible AccountId candidates from warframe.com cookies + web storage,
 * best first (`gid` cookie → other cookies → storage), keeping only the best
 * source per id.
 */
export function accountIdCandidates(
  cookies: readonly CookieLike[],
  storages: Record<string, unknown> = {},
): AccountIdCandidate[] {
  const found = new Map<string, AccountIdSource>();

  const add = (raw: unknown, source: AccountIdSource): void => {
    for (const match of String(raw ?? '').match(/[0-9a-f]{24}/gi) ?? []) {
      const id = match.toLowerCase();
      if (!looksLikeAccountId(id)) continue;
      const known = found.get(id);
      if (known === undefined || PRIORITY[source] < PRIORITY[known]) found.set(id, source);
    }
  };

  for (const cookie of cookies) {
    if (!cookie.domain.endsWith('warframe.com')) continue;
    let value = cookie.value ?? '';
    try {
      value = decodeURIComponent(value);
    } catch {
      /* keep the raw value */
    }
    add(value, cookie.name === 'gid' ? 'gid' : 'cookie');
  }
  for (const value of Object.values(storages)) add(value, 'storage');

  return [...found.entries()]
    .map(([id, source]) => ({ id, source }))
    .sort((a, b) => PRIORITY[a.source] - PRIORITY[b.source]);
}
