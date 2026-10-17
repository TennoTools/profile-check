import { describe, expect, it, vi } from 'vitest';
import { explainStatus, fetchProfile, ProfileFetchError, wrapWithScraperApi } from '../src';

const ACCOUNT_ID = '505875fb1a4d80894a000000';
const DIRECT_URL = `https://api.warframe.com/cdn/getProfileViewingData.php?playerId=${ACCOUNT_ID}`;

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

const goodPayload = { Results: [{ profile: { displayName: 'X' } }] };

describe('wrapWithScraperApi', () => {
  it('url-encodes both the key and the target url', () => {
    expect(wrapWithScraperApi('https://x/y?z=1', 'key&1')).toBe(
      'https://api.scraperapi.com/?api_key=key%261&url=https%3A%2F%2Fx%2Fy%3Fz%3D1',
    );
  });
});

describe('explainStatus', () => {
  it('explains 404/409 as unknown account', () => {
    expect(explainStatus(404, ACCOUNT_ID)).toContain('No profile found');
    expect(explainStatus(409, ACCOUNT_ID)).toContain('No profile found');
  });
  it('explains 500 with the in-game option hint', () => {
    const message = explainStatus(500, ACCOUNT_ID);
    expect(message).toContain('profile viewing is disabled');
    expect(message).toContain('Esc > Options > Social');
  });
  it('falls back to a generic message', () => {
    expect(explainStatus(418, ACCOUNT_ID)).toContain('Unexpected HTTP status 418');
  });
});

describe('fetchProfile', () => {
  it('fetches directly and returns the payload metadata', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(goodPayload));
    const result = await fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: false, fetchImpl });
    expect(result.via).toBe('direct');
    expect(result.httpStatus).toBe(200);
    expect(result.apiUrl).toBe(DIRECT_URL);
    expect(result.bodyLength).toBeGreaterThan(0);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(fetchImpl).toHaveBeenCalledWith(DIRECT_URL, expect.objectContaining({ redirect: 'follow' }));
  });

  it('uses console hosts for consoles', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(goodPayload));
    const result = await fetchProfile({ platform: 'ps4', accountId: ACCOUNT_ID, useProxy: false, fetchImpl });
    expect(result.apiUrl).toBe(`https://api-ps4.warframe.com/cdn/getProfileViewingData.php?playerId=${ACCOUNT_ID}`);
  });

  it('falls back to ScraperAPI only when the direct request throws', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(goodPayload));
    const result = await fetchProfile({
      platform: 'pc',
      accountId: ACCOUNT_ID,
      useProxy: false,
      scraperApiKey: 'secret',
      fetchImpl,
    });
    expect(result.via).toBe('scraperapi-fallback');
    const secondUrl = String(fetchImpl.mock.calls[1]?.[0]);
    expect(secondUrl.startsWith('https://api.scraperapi.com/')).toBe(true);
    expect(secondUrl).toContain(encodeURIComponent(DIRECT_URL));
  });

  it('never falls back on an HTTP error status', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'nope' }, 500));
    await expect(
      fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: false, scraperApiKey: 'secret', fetchImpl }),
    ).rejects.toThrow(/profile viewing is disabled/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps timeouts to a ProfileFetchError with the timeout message', async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error('aborted');
      error.name = 'TimeoutError';
      throw error;
    });
    await expect(
      fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: false, fetchImpl, timeoutMs: 1234 }),
    ).rejects.toThrow(/Timeout \(1234 ms\) contacting api\.warframe\.com/);
  });

  it('rejects invalid JSON with a snippet', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>oops</html>', { status: 200 }));
    const error = (await fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: false, fetchImpl }).catch(
      (reason: unknown) => reason,
    )) as ProfileFetchError;
    expect(error).toBeInstanceOf(ProfileFetchError);
    expect(error.message).toContain('not valid JSON');
    expect(error.bodySnippet).toContain('<html>');
  });

  it('rejects missing/empty Results', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ Results: [] }));
    await expect(fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: false, fetchImpl })).rejects.toThrow(
      /No profile in response/,
    );
  });

  it('refuses proxy mode without a key', async () => {
    await expect(fetchProfile({ platform: 'pc', accountId: ACCOUNT_ID, useProxy: true })).rejects.toThrow(
      /no key available/,
    );
  });
});
