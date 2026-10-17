/**
 * Offline parity test on a real DE response captured by `npm run check:live`
 * (packages/core/test/fixtures/profile.raw.json). Skipped when the fixture is
 * absent — capture it once from the repo root: `npm run check:live`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveVerdict, type ParserLike, parseProfile, summaryView, validateProfile } from '../src';

const fixturePath = fileURLToPath(new URL('fixtures/profile.raw.json', import.meta.url));
const hasFixture = existsSync(fixturePath);

describe.runIf(hasFixture)('live fixture (captured from DE)', () => {
  const data = JSON.parse(readFileSync(fixturePath, 'utf8')) as Parameters<typeof parseProfile>[0];
  const parser = parseProfile(data);
  const summary = summaryView(parser as unknown as ParserLike);
  const checks = validateProfile(parser as unknown as ParserLike, summary.accountId ?? '');

  it('parses without throwing and passes all 13 checks', () => {
    expect(checks).toHaveLength(13);
    expect(checks.filter((check) => !check.ok)).toEqual([]);
    expect(deriveVerdict(checks)).toBe('ok');
  });

  it('extracts a coherent summary from the fixture', () => {
    expect(summary.accountId).toMatch(/^[0-9a-f]{24}$/);
    expect(summary.nickname).toBeTruthy();
    expect(summary.masteryRank).toBeGreaterThanOrEqual(0);
    expect(summary.created).toBeTruthy();
    expect(summary.timePlayedSec).toBeGreaterThan(0);
  });
});
