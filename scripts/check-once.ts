/**
 * One-shot live check from the terminal, reusing @tennotools/profile-check-core end-to-end
 * (no server needed). Used to validate parity with the legacy v1 CLI.
 *
 *   npm run check:live      fetch from DE (1 request), save the fixture, validate
 *   npm run check:offline   validate the saved fixture, no network
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  deriveVerdict,
  fetchProfile,
  formatDuration,
  type Platform,
  parseProfile,
  summaryView,
  validateProfile,
} from '@tennotools/profile-check-core';
import { readDotEnv } from '../apps/server/src/dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const fixturePath = join(root, 'packages', 'core', 'test', 'fixtures', 'profile.raw.json');
const offline = process.argv.includes('--offline');

const dotEnv = readDotEnv(join(root, '.env'));
const accountId = (process.env.WARFRAME_ACCOUNT_ID ?? dotEnv.WARFRAME_ACCOUNT_ID ?? '').toLowerCase();
const scraperApiKey = process.env.SCRAPERAPI_KEY ?? dotEnv.SCRAPERAPI_KEY;
const platform = (process.env.TENNOTOOLS_PLATFORM ?? 'pc') as Platform;

if (!accountId) {
  console.error('✗ No AccountId — set WARFRAME_ACCOUNT_ID in .env (or use the GUI Get-ID helper).');
  process.exit(1);
}

let data: unknown;
if (offline) {
  if (!existsSync(fixturePath)) {
    console.error(`✗ No fixture at ${fixturePath} — run npm run check:live once first.`);
    process.exit(1);
  }
  data = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
  console.log(`→ offline mode: using ${fixturePath}`);
} else {
  console.log(`→ GET profile ${accountId} on ${platform} (1 request, direct)`);
  const fetched = await fetchProfile({
    platform,
    accountId,
    useProxy: false,
    scraperApiKey,
  });
  console.log(`✓ fetched ${fetched.bodyLength} bytes in ${fetched.elapsedMs} ms (via ${fetched.via}) — saving fixture`);
  mkdirSync(join(root, 'packages', 'core', 'test', 'fixtures'), { recursive: true });
  writeFileSync(fixturePath, `${JSON.stringify(fetched.data, null, 2)}\n`);
  data = fetched.data;
}

const parser = parseProfile(data as Parameters<typeof parseProfile>[0]);
const view = summaryView(parser);
// Live: validate against the requested id; offline: against the fixture's own id.
const requestedId = offline ? (view.accountId ?? accountId) : accountId;
const checks = validateProfile(parser, requestedId);
const verdict = deriveVerdict(checks);

console.log(
  [
    '',
    ' PROFILE SUMMARY',
    ` Nickname         : ${view.nickname}`,
    ` Mastery rank     : ${view.masteryRank}`,
    ` Account created  : ${view.created ? new Date(view.created).toLocaleDateString('en-US') : 'unknown'}`,
    ` Time played      : ${formatDuration(view.timePlayedSec)}`,
    ` Missions         : ${view.missions.completed} done / ${view.missions.failed} failed`,
    ` Clan             : ${view.clan ? `${view.clan.name} (tier ${view.clan.tier}, class ${view.clan.class})` : 'none'}`,
    ` Loadout          : ${view.loadout.warframe} / ${view.loadout.primary} / ${view.loadout.secondary} / ${view.loadout.melee}`,
    ` XpCacheExpiryDate: ${view.xpCacheExpiryDate ?? 'n/a'}`,
    '',
  ].join('\n'),
);

for (const check of checks) {
  console.log(
    `${check.ok ? '✓' : check.critical ? '✗' : '⚠'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`,
  );
}

console.log('');
console.log(
  ` VERDICT: ${verdict === 'ok' ? '✓ THE PARSER WORKS PERFECTLY' : verdict === 'warnings' ? '✓ WORKS (warnings)' : '✗ LOOKS BROKEN'}`,
);
process.exitCode = verdict === 'ok' ? 0 : verdict === 'warnings' ? 0 : 3;
