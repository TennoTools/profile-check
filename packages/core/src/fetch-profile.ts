/**
 * Profile fetching from Digital Extremes, with optional ScraperAPI proxy and the
 * v1 fallback semantics: direct first, retry through ScraperAPI only when the
 * direct request *throws* (network/timeout) and a key is available. HTTP error
 * statuses are explained, never retried.
 */

import { apiHost, type Platform, profileUrl } from './platforms';

export const SCRAPERAPI_ENDPOINT = 'https://api.scraperapi.com/';
export const DEFAULT_TIMEOUT_MS = 30_000;
export const USER_AGENT = 'tennotools/2.0 (+https://github.com/TennoTools)';

export type FetchVia = 'direct' | 'scraperapi' | 'scraperapi-fallback';

export interface FetchProfileOptions {
  platform: Platform;
  accountId: string;
  useProxy: boolean;
  scraperApiKey?: string;
  timeoutMs?: number;
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export interface FetchedProfile {
  data: unknown;
  elapsedMs: number;
  bodyLength: number;
  via: FetchVia;
  apiUrl: string;
  httpStatus: number;
}

/** Fetch failure carrying a short response snippet for diagnostics. */
export class ProfileFetchError extends Error {
  readonly bodySnippet: string | undefined;

  constructor(message: string, bodySnippet?: string) {
    super(message);
    this.name = 'ProfileFetchError';
    this.bodySnippet = bodySnippet;
  }
}

export const wrapWithScraperApi = (url: string, key: string): string =>
  `${SCRAPERAPI_ENDPOINT}?api_key=${encodeURIComponent(key)}&url=${encodeURIComponent(url)}`;

export function explainStatus(status: number, id: string): string {
  if (status === 404 || status === 409) return `No profile found for AccountId ${id} (${status}).`;
  if (status === 500)
    return (
      `DE returned error 500 for ${id}: wrong AccountId, or profile viewing is disabled.\n` +
      '  → In game: Esc > Options > Social > enable profile viewing, then retry.'
    );
  return `Unexpected HTTP status ${status} from the Warframe API.`;
}

interface HttpResult {
  status: number;
  ok: boolean;
  body: string;
  elapsedMs: number;
}

async function httpGet(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<HttpResult> {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.text();
    return { status: response.status, ok: response.ok, body, elapsedMs: Date.now() - startedAt };
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProfileFetchError(`Timeout (${timeoutMs} ms) contacting ${new URL(url).host}`);
    }
    throw error;
  }
}

export async function fetchProfile(options: FetchProfileOptions): Promise<FetchedProfile> {
  const { platform, accountId, useProxy, scraperApiKey, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = options;

  const apiUrl = profileUrl(platform, accountId);
  if (useProxy && !scraperApiKey) {
    throw new ProfileFetchError(`ScraperAPI selected but no key available (host ${apiHost(platform)}).`);
  }

  let via: FetchVia = useProxy ? 'scraperapi' : 'direct';
  let response: HttpResult;
  try {
    response = await httpGet(
      useProxy ? wrapWithScraperApi(apiUrl, scraperApiKey as string) : apiUrl,
      timeoutMs,
      fetchImpl,
    );
  } catch (error) {
    if (useProxy || !scraperApiKey) throw error;
    via = 'scraperapi-fallback';
    response = await httpGet(wrapWithScraperApi(apiUrl, scraperApiKey), timeoutMs, fetchImpl);
  }

  if (!response.ok) {
    throw new ProfileFetchError(explainStatus(response.status, accountId), response.body.slice(0, 300));
  }

  let data: unknown;
  try {
    data = JSON.parse(response.body);
  } catch {
    throw new ProfileFetchError('Response from DE is not valid JSON.', response.body.slice(0, 300));
  }

  const results = (data as { Results?: unknown } | null)?.Results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new ProfileFetchError(
      'No profile in response (missing or empty Results) — check the id and that profile viewing is enabled in game.',
      JSON.stringify(data).slice(0, 300),
    );
  }

  return {
    data,
    elapsedMs: response.elapsedMs,
    bodyLength: response.body.length,
    via,
    apiUrl,
    httpStatus: response.status,
  };
}
