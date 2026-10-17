/** First-run helpers: is the app configured yet, and the public sample account. */

/** Public, always-viewable sample profile: [DE]Rebecca (MR 34, account of 2012). */
export const SAMPLE_ACCOUNT_ID = '505875fb1a4d80894a000000';

/** No ScraperAPI key and no AccountId saved → the /init wizard should run. */
export function needsSetup(settings: { hasScraperApiKey: boolean; defaultAccountId: string | null }): boolean {
  return !settings.hasScraperApiKey && settings.defaultAccountId === null;
}

const INIT_SKIP_KEY = 'profile-check-init-skipped';

/** True when the wizard was skipped for this browser session (it re-proposes next session). */
export function initSkipped(): boolean {
  try {
    return sessionStorage.getItem(INIT_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

export function skipInit(): void {
  try {
    sessionStorage.setItem(INIT_SKIP_KEY, '1');
  } catch {
    /* private mode — the wizard simply re-proposes */
  }
}

export function clearInitSkip(): void {
  try {
    sessionStorage.removeItem(INIT_SKIP_KEY);
  } catch {
    /* nothing to clear */
  }
}
