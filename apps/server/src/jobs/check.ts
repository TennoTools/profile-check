/**
 * Check job: fetch → parse → validate → persist, emitting SSE progress events.
 * One HTTP call per run (plus at most one fallback retry, inside fetchProfile).
 */

import {
  type CheckEvent,
  deriveVerdict,
  fetchProfile,
  type ProfileData,
  ProfileFetchError,
  parseProfile,
  profileUrl,
  type RunError,
  type RunRequest,
  summaryView,
  validateProfile,
} from '@tennotools/profile-check-core';
import type { RunsStore, SettingsStore } from '../db';
import type { EventBus } from '../run-bus';

export interface CheckJobDeps {
  runs: RunsStore;
  settings: SettingsStore;
  bus: EventBus<CheckEvent>;
  fetchImpl?: typeof fetch;
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export async function startCheck(id: string, request: RunRequest, deps: CheckJobDeps): Promise<void> {
  const { runs, settings, bus } = deps;
  const emit = (event: CheckEvent): void => bus.publish(id, event);

  runs.markRunning(id);
  const scraperApiKey = settings.get('scraperapi_key');
  const timeoutMs = settings.getNumber('timeout_ms', 30_000);
  const apiUrl = profileUrl(request.platform, request.accountId);

  let stage: 'fetch' | 'parse' = 'fetch';
  try {
    emit({
      event: 'progress',
      data: { step: 'fetch', detail: `GET ${apiUrl}${request.useProxy ? ' (via ScraperAPI)' : ''}` },
    });
    const fetched = await fetchProfile({
      platform: request.platform,
      accountId: request.accountId,
      useProxy: request.useProxy,
      scraperApiKey,
      timeoutMs,
      fetchImpl: deps.fetchImpl,
    });

    stage = 'parse';
    emit({ event: 'progress', data: { step: 'parse' } });
    const parser = parseProfile(fetched.data as ProfileData);

    emit({ event: 'progress', data: { step: 'validate' } });
    const checks = validateProfile(parser, request.accountId);
    const failed = checks.filter((check) => !check.ok);
    const critical = failed.filter((check) => check.critical);
    const summary = summaryView(parser);
    const verdict = deriveVerdict(checks);

    emit({
      event: 'progress',
      data: { step: 'persist', passed: checks.length - failed.length, failed: failed.length },
    });

    const error: RunError | null = critical[0]
      ? { type: 'critical', message: `Critical check failed: ${critical[0].label}`, bodySnippet: null }
      : null;

    const result = runs.finish(id, {
      state: 'done',
      verdict,
      source: {
        url: fetched.apiUrl,
        via: fetched.via,
        httpStatus: fetched.httpStatus,
        sizeBytes: fetched.bodyLength,
        durationMs: fetched.elapsedMs,
        xpCacheExpiryDate: summary.xpCacheExpiryDate,
      },
      summary,
      checks,
      error,
    });
    emit({ event: 'done', data: result });
  } catch (error) {
    const runError: RunError = {
      type: stage === 'fetch' ? 'fetch' : 'parse',
      message: errorMessage(error),
      bodySnippet: error instanceof ProfileFetchError ? (error.bodySnippet ?? null) : null,
    };
    runs.finish(id, { state: 'failed', verdict: null, source: null, summary: null, checks: [], error: runError });
    emit({ event: 'error', data: runError });
  }
}
