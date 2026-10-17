import { looksLikeAccountId } from '@tennotools/profile-check-core/web';
import { describe, expect, it } from 'vitest';
import { initSkipped, needsSetup, SAMPLE_ACCOUNT_ID } from '../src/lib/setup';

describe('needsSetup', () => {
  it('sends a brand-new install to the wizard', () => {
    expect(needsSetup({ hasScraperApiKey: false, defaultAccountId: null })).toBe(true);
  });

  it('stays away once a key or an account id exists', () => {
    expect(needsSetup({ hasScraperApiKey: true, defaultAccountId: null })).toBe(false);
    expect(needsSetup({ hasScraperApiKey: false, defaultAccountId: SAMPLE_ACCOUNT_ID })).toBe(false);
  });
});

describe('SAMPLE_ACCOUNT_ID', () => {
  it('passes the same plausibility guard the API uses', () => {
    expect(looksLikeAccountId(SAMPLE_ACCOUNT_ID)).toBe(true);
  });
});

describe('initSkipped', () => {
  it('is false when no session flag was set', () => {
    expect(initSkipped()).toBe(false);
  });
});
