/** EventSource wrappers for the two SSE streams (runs + get-id). */

import {
  type CheckProgress,
  checkProgressSchema,
  type GetIdEvent,
  getIdEventSchema,
  type RunError,
  type RunResult,
  runErrorSchema,
  runResultSchema,
} from '@tennotools/profile-check-core/web';

const TERMINAL_GET_ID_STATES: ReadonlySet<GetIdEvent['state']> = new Set([
  'found',
  'closed',
  'timeout',
  'cancelled',
  'error',
]);

const parseData = <T>(event: Event): T | undefined => {
  const raw = (event as MessageEvent).data;
  if (typeof raw !== 'string') return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
};

export interface RunHandlers {
  onProgress?: (progress: CheckProgress) => void;
  onDone?: (run: RunResult) => void;
  onServerError?: (error: RunError) => void;
}

export function subscribeToRun(id: string, handlers: RunHandlers): EventSource {
  const source = new EventSource(`/api/runs/${encodeURIComponent(id)}/events`);
  source.addEventListener('progress', (event) => {
    const parsed = checkProgressSchema.safeParse(parseData(event));
    if (parsed.success) handlers.onProgress?.(parsed.data);
  });
  source.addEventListener('done', (event) => {
    const parsed = runResultSchema.safeParse(parseData(event));
    if (parsed.success) handlers.onDone?.(parsed.data);
    source.close();
  });
  source.addEventListener('error', (event) => {
    if (source.readyState === EventSource.CLOSED) return; // terminal close, not a failure
    const parsed = runErrorSchema.safeParse(parseData(event));
    if (parsed.success) handlers.onServerError?.(parsed.data);
    source.close();
  });
  return source;
}

export interface DiscoverHandlers {
  onStatus: (event: GetIdEvent) => void;
  onConnectionError?: () => void;
}

export function subscribeToDiscover(jobId: string, handlers: DiscoverHandlers): EventSource {
  const source = new EventSource(`/api/account-id/discover/events?jobId=${encodeURIComponent(jobId)}`);
  source.addEventListener('status', (event) => {
    const parsed = getIdEventSchema.safeParse(parseData(event));
    if (!parsed.success) return;
    handlers.onStatus(parsed.data);
    if (TERMINAL_GET_ID_STATES.has(parsed.data.state)) source.close();
  });
  source.addEventListener('error', () => {
    // The server closes the stream after a terminal event; anything else is a
    // real connection problem.
    if (source.readyState === EventSource.CLOSED) return;
    handlers.onConnectionError?.();
    source.close();
  });
  return source;
}
