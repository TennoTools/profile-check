/**
 * Regression tests for the typed web API client.
 *
 * The one that matters: body-less POSTs (account-id discover/cancel) must NOT
 * send `content-type: application/json` — Fastify answers 400
 * FST_ERR_CTP_EMPTY_JSON_BODY otherwise (that is what broke "Find my Account ID").
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelDiscover, startDiscover, startRun } from '../src/lib/api';

const fetchMock = vi.fn<typeof fetch>();

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const lastCall = (): Parameters<typeof fetch> => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return call;
};

const hasJsonContentType = (init: RequestInit | undefined): boolean => new Headers(init?.headers).has('content-type');

describe('web api client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('startDiscover: POSTs without a body or JSON content-type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(202, { jobId: 'job-1' }));

    await expect(startDiscover()).resolves.toEqual({ jobId: 'job-1' });

    const [path, init] = lastCall();
    expect(path).toBe('/api/account-id/discover');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    expect(hasJsonContentType(init)).toBe(false);
  });

  it('cancelDiscover: POSTs without a body and accepts 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(cancelDiscover()).resolves.toBeUndefined();

    const [, init] = lastCall();
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
    expect(hasJsonContentType(init)).toBe(false);
  });

  it('startRun: sends the JSON content-type with the serialized payload', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(202, { id: 'run-1' }));

    await expect(startRun({ platform: 'pc', accountId: '505875fb1a4d80894a000000', useProxy: false })).resolves.toEqual(
      { id: 'run-1' },
    );

    const [, init] = lastCall();
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({
      platform: 'pc',
      accountId: '505875fb1a4d80894a000000',
      useProxy: false,
    });
  });

  it('extracts the most specific server error: Fastify `message`, then `error`', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { statusCode: 400, error: 'Bad Request', message: 'Body cannot be empty' }),
    );
    await expect(startDiscover()).rejects.toThrow('Body cannot be empty');

    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'A discover job is already running' }));
    await expect(startDiscover()).rejects.toThrow('A discover job is already running');
  });
});
