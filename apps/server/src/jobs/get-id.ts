/**
 * Get-ID job — port of v1 get-account-id.mjs, driven by the local web GUI:
 * temporary Chromium + manual warframe.com login → read cookies/storage →
 * emit the found AccountId. Everything is erased when the browser closes.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountIdCandidates, type GetIdEvent } from '@tennotools/profile-check-core';
import { type BrowserContext, chromium } from 'playwright';
import type { EventBus } from '../run-bus';

const LOGIN_URL = 'https://www.warframe.com/login';
const POLL_MS = 1_500;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export interface GetIdJobOptions {
  bus: EventBus<GetIdEvent>;
  jobId: string;
  extensionPath: string;
  timeoutMs: number;
}

export interface DiscoverJobHandle {
  jobId: string;
  cancel: () => void;
  run: () => Promise<void>;
}

export class GetIdJob implements DiscoverJobHandle {
  readonly jobId: string;

  private readonly options: GetIdJobOptions;
  private context: BrowserContext | undefined;
  private tempProfile: string | undefined;
  private cancelled = false;
  private finished = false;

  constructor(options: GetIdJobOptions) {
    this.options = options;
    this.jobId = options.jobId;
  }

  private emit(event: GetIdEvent): void {
    this.options.bus.publish(this.jobId, event);
  }

  /** Close the browser and delete the temp profile (best effort, Windows retries). */
  async shutdown(): Promise<void> {
    await this.context?.close().catch(() => {});
    this.context = undefined;
    if (this.tempProfile) {
      await rm(this.tempProfile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }).catch(() => {});
      this.tempProfile = undefined;
    }
  }

  cancel(): void {
    if (this.finished) return;
    this.cancelled = true;
    void this.context?.close().catch(() => {});
  }

  async run(): Promise<void> {
    const { extensionPath, timeoutMs } = this.options;
    try {
      this.emit({ state: 'launching' });
      this.tempProfile = await mkdtemp(join(tmpdir(), 'tennotools-getid-'));
      this.context = await chromium.launchPersistentContext(this.tempProfile, {
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'], // no "controlled by automated software" bar
        args: [
          '--disable-blink-features=AutomationControlled', // navigator.webdriver = false
          `--disable-extensions-except=${extensionPath}`,
          `--load-extension=${extensionPath}`, // in-site "temporary browser" banner
        ],
      });
    } catch (error) {
      this.finished = true;
      await this.shutdown();
      const message = error instanceof Error ? error.message : String(error);
      this.emit({
        state: 'error',
        message: /Executable doesn't exist|playwright install/.test(message)
          ? 'Chromium is not installed — run once: npx playwright install chromium'
          : `Could not launch Chromium: ${message.split('\n')[0]}`,
      });
      return;
    }

    const context = this.context;
    const page = context.pages()[0] ?? (await context.newPage());
    try {
      await page.goto(LOGIN_URL);
      await sleep(1_500);
      await page.reload(); // fresh session/reCAPTCHA state before any typing
    } catch {
      /* the user may close the window quickly — the poll loop below reports it */
    }

    this.emit({ state: 'waiting-login' });

    const onAccountPage = (): boolean => {
      try {
        const path = new URL(page.url()).pathname;
        return /\/user\/?$/i.test(path) || /^\/(?:[a-z]{2}(?:-[a-z]{2,4})?)?\/?$/i.test(path);
      } catch {
        return false;
      }
    };

    const deadline = Date.now() + timeoutMs;
    let closedByUser = false;
    page.on('close', () => {
      closedByUser = true;
    });

    while (!this.cancelled && !closedByUser && Date.now() < deadline) {
      try {
        if (onAccountPage()) {
          const storages = await page.evaluate(() => ({ ...localStorage, ...sessionStorage })).catch(() => ({}));
          const candidates = accountIdCandidates(await context.cookies(), storages as Record<string, unknown>);
          const best = candidates[0];
          if (best) {
            this.finished = true;
            await this.shutdown();
            this.emit({ state: 'found', accountId: best.id, source: best.source });
            return;
          }
        }
      } catch {
        closedByUser = true;
      }
      if (!this.cancelled && !closedByUser) await sleep(POLL_MS);
    }

    this.finished = true;
    await this.shutdown();
    if (this.cancelled) {
      this.emit({ state: 'cancelled' });
    } else if (closedByUser) {
      this.emit({ state: 'closed', message: 'Browser closed before an account id was found.' });
    } else {
      this.emit({
        state: 'timeout',
        message: `No account id found after ${Math.round(timeoutMs / 1000)} s — did you finish logging in?`,
      });
    }
  }
}
