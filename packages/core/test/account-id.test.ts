import { describe, expect, it } from 'vitest';
import { accountIdCandidates, looksLikeAccountId } from '../src';

const idAt = (unixSeconds: number, filler = '0'): string =>
  `${Math.floor(unixSeconds).toString(16).padStart(8, '0')}${filler.repeat(16).slice(0, 16)}`;

const ID_2026 = '6acc3cbc4499b934fa0956e2';

describe('looksLikeAccountId', () => {
  it('accepts a real-style 2026 ObjectId', () => {
    expect(looksLikeAccountId(ID_2026)).toBe(true);
  });

  it('accepts the uppercase form', () => {
    expect(looksLikeAccountId(ID_2026.toUpperCase())).toBe(true);
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
    expect(looksLikeAccountId('zzzzcbc4499b934fa0956e2')).toBe(false);
    expect(looksLikeAccountId('6acc3cbc4499b934fa0956e')).toBe(false);
    expect(looksLikeAccountId(undefined)).toBe(false);
    expect(looksLikeAccountId(42)).toBe(false);
  });
});

describe('accountIdCandidates', () => {
  it('extracts nothing from irrelevant cookies', () => {
    const candidates = accountIdCandidates([
      { name: 'gid', domain: 'example.com', value: ID_2026 },
      { name: 'gid', domain: 'warframe.com', value: 'nothing-here' },
    ]);
    expect(candidates).toEqual([]);
  });

  it('orders candidates gid → other cookies → storage and dedupes', () => {
    const other = idAt(Date.UTC(2015, 0, 1) / 1000, 'a');
    const candidates = accountIdCandidates(
      [
        { name: 'session', domain: 'www.warframe.com', value: `x=${other}` },
        { name: 'gid', domain: 'warframe.com', value: ID_2026 },
      ],
      { some: `prefer=${other}` },
    );
    expect(candidates).toEqual([
      { id: ID_2026, source: 'gid' },
      { id: other, source: 'cookie' },
    ]);
  });

  it('url-decodes cookie values before matching', () => {
    const candidates = accountIdCandidates([{ name: 'gid', domain: 'warframe.com', value: `prefix%20${ID_2026}` }]);
    expect(candidates).toEqual([{ id: ID_2026, source: 'gid' }]);
  });

  it('reads storage values when no cookie matches', () => {
    const candidates = accountIdCandidates([], { key: `"account":{"id":"${ID_2026}"}` });
    expect(candidates).toEqual([{ id: ID_2026, source: 'storage' }]);
  });
});
