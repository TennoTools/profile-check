/** Typed API client — every response is zod-parsed through the shared core schemas. */

import {
  type Platform,
  type RunList,
  type RunResult,
  runListSchema,
  runResultSchema,
  type SettingsUpdate,
  type SettingsView,
  settingsViewSchema,
} from '@tennotools/profile-check-core/web';

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  // Only advertise a JSON content-type when there is actually a body — Fastify
  // rejects `content-type: application/json` requests with an empty body
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which broke the body-less account-id POSTs.
  const requestBody: BodyInit | null | undefined = init?.body;
  const headers = new Headers(init?.headers);
  if (requestBody !== undefined && requestBody !== null && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error?: unknown; message?: unknown };
      if (typeof payload.message === 'string' && payload.message) message = payload.message;
      else if (typeof payload.error === 'string' && payload.error) message = payload.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export interface HealthView {
  ok: boolean;
  version: string;
}

export const fetchHealth = async (): Promise<HealthView> => request('/api/health');

export const fetchSettings = async (): Promise<SettingsView> =>
  settingsViewSchema.parse(await request('/api/settings'));

export const updateSettings = async (update: SettingsUpdate): Promise<SettingsView> =>
  settingsViewSchema.parse(await request('/api/settings', { method: 'PUT', body: JSON.stringify(update) }));

export const fetchRuns = async (limit = 20, offset = 0): Promise<RunList> =>
  runListSchema.parse(await request(`/api/runs?limit=${limit}&offset=${offset}`));

export const fetchRun = async (id: string): Promise<RunResult> =>
  runResultSchema.parse(await request(`/api/runs/${encodeURIComponent(id)}`));

export const startRun = async (payload: {
  platform: Platform;
  accountId: string;
  useProxy: boolean;
}): Promise<{ id: string }> => request('/api/runs', { method: 'POST', body: JSON.stringify(payload) });

export const startDiscover = async (): Promise<{ jobId: string }> =>
  request('/api/account-id/discover', { method: 'POST' });

export const cancelDiscover = async (): Promise<void> => {
  await request('/api/account-id/discover/cancel', { method: 'POST' });
};
