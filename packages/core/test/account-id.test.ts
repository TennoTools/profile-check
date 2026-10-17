import { describe, expect, it } from 'vitest';
import { accountIdCandidates, looksLikeAccountId } from '../src';

const idAt = (unixSeconds: number, filler = '0'): string =>
  `${Math.floor(unixSeconds).toString(16).padStart(8, '0')}${filler.repeat(16).slice(0, 16)}`;

const ACCOUNT_ID = '505875fb1a4d80894a000000';

describe('looksLikeAccountId', () => {
  it('accepts a real-style 2012 ObjectId', () => {
    expect(looksLikeAccountId(ACCOUNT_ID)).toBe(true);
  });

  it('accepts the uppercase form', () => {
    expect(looksLikeAccountId(ACCOUNT_ID.toUpperCase())).toBe(true);
  });

  it('accepts the 2012-01-01 lower boundary exactly', () => {
    expect(looksLikeAccountId(idAt(Date.UTC(2012, 0, 1) / 1000))).toBe(true);
  });

  it('rejects one day before 2012', () => {
    expect(looksLikeAccountId(idAt(Date.UTC(2011, 11, 31) / 1000))).toBe(false);
  });

  it('rejects timestamps more than a year in the future', () => {
    expect(looksLikeAccountId(idAt(Date.now() / 1000 + 2 * 366 * 24 * 3600))).toBe(false);
  });

  it('rejects non-hex, short and non-string values', () => {
    expect(looksLikeAccountId('zzzz75fb1a4d80894a000000')).toBe(false);
    expect(looksLikeAccountId('505875fb1a4d80894a00000')).toBe(false);
    expect(looksLikeAccountId(undefined)).toBe(false);
    expect(looksLikeAccountId(42)).toBe(false);
  });
});

describe('accountIdCandidates', () => {
  it('extracts nothing from irrelevant cookies', () => {
    const candidates = accountIdCandidates([
      { name: 'gid', domain: 'example.com', value: ACCOUNT_ID },
      { name: 'gid', domain: 'warframe.com', value: 'nothing-here' },
    ]);
    expect(candidates).toEqual([]);
  });

  it('orders candidates gid → other cookies → storage and dedupes', () => {
    const other = idAt(Date.UTC(2015, 0, 1) / 1000, 'a');
    const candidates = accountIdCandidates(
      [
        { name: 'session', domain: 'www.warframe.com', value: `x=${other}` },
        { name: 'gid', domain: 'warframe.com', value: ACCOUNT_ID },
      ],
      { some: `prefer=${other}` },
    );
    expect(candidates).toEqual([
      { id: ACCOUNT_ID, source: 'gid' },
      { id: other, source: 'cookie' },
    ]);
  });

  it('url-decodes cookie values before matching', () => {
    const candidates = accountIdCandidates([{ name: 'gid', domain: 'warframe.com', value: `prefix%20${ACCOUNT_ID}` }]);
    expect(candidates).toEqual([{ id: ACCOUNT_ID, source: 'gid' }]);
  });

  it('reads storage values when no cookie matches', () => {
    const candidates = accountIdCandidates([], { key: `"account":{"id":"${ACCOUNT_ID}"}` });
    expect(candidates).toEqual([{ id: ACCOUNT_ID, source: 'storage' }]);
  });
});
