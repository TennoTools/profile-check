import type { GetIdEvent } from '@tennotools/profile-check-core/web';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cancelDiscover, startDiscover } from '../lib/api';
import { subscribeToDiscover } from '../lib/sse';
import { buttonGhost, buttonPrimary } from './controls';

const TERMINAL: ReadonlySet<GetIdEvent['state']> = new Set(['found', 'closed', 'timeout', 'cancelled', 'error']);

export function GetIdModal({
  open,
  onClose,
  onUse,
  useLabel = 'Use this Account ID',
}: {
  open: boolean;
  onClose: () => void;
  onUse: (accountId: string) => void;
  /** Label of the confirm button in the "found" state (e.g. "Use & run"). */
  useLabel?: string;
}) {
  const [status, setStatus] = useState<GetIdEvent | null>(null);
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const sourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the discovery when "Try again" is clicked
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    setStatus(null);
    setCopied(false);
    void (async () => {
      try {
        const { jobId } = await startDiscover();
        if (disposed) {
          void cancelDiscover().catch(() => {});
          return;
        }
        sourceRef.current = subscribeToDiscover(jobId, {
          onStatus: (event) => setStatus(event),
          onConnectionError: () => setStatus({ state: 'error', message: 'Lost the connection to the local API.' }),
        });
      } catch (error) {
        setStatus({ state: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [open, attempt, cleanup]);

  if (!open) return null;

  const running = status !== null && !TERMINAL.has(status.state);
  const close = (): void => {
    if (running) void cancelDiscover().catch(() => {});
    cleanup();
    onClose();
  };

  const copy = async (): Promise<void> => {
    if (!status?.accountId) return;
    try {
      await navigator.clipboard.writeText(status.accountId);
      setCopied(true);
    } catch {
      /* selection lets the user copy manually */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={close} />
      <div
        className="relative w-full max-w-lg rounded-xl border border-panel-border bg-panel p-6 shadow-[0_24px_80px_rgba(0,0,0,0.9)]"
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Find your AccountId"
      >
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-accent">Find your AccountId</h2>
        <p className="mt-1 text-xs text-muted">
          Opens a temporary Chromium on the warframe.com login page. Log in manually — everything (cookies, session,
          temp profile) is erased when it closes. No password ever leaves the browser.
        </p>

        <div className="mt-5 rounded-lg border border-panel-border bg-black/40 p-4 text-sm">
          {status === null || status.state === 'launching' ? (
            <div className="flex items-center gap-3">
              <span className="tt-spinner" />
              <span>Launching Chromium…</span>
            </div>
          ) : status.state === 'waiting-login' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="tt-spinner" />
                <span>Waiting for your login on warframe.com…</span>
              </div>
              <p className="text-xs text-muted">
                If a reCAPTCHA appears, solve it and submit again — waiting continues. The browser closes itself once
                your AccountId is found.
              </p>
            </div>
          ) : status.state === 'found' ? (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-ok">Login detected</p>
              <code className="block truncate rounded border border-panel-border bg-black/60 px-3 py-2 font-mono text-xs text-accent">
                {status.accountId}
              </code>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonGhost} onClick={() => void copy()}>
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
                <button
                  type="button"
                  className={buttonPrimary}
                  onClick={() => {
                    if (status.accountId) onUse(status.accountId);
                    close();
                  }}
                >
                  {useLabel}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-warn">
                {status.message ??
                  {
                    closed: 'Browser closed before an account id was found.',
                    timeout: 'Timed out — did you finish logging in?',
                    cancelled: 'Cancelled.',
                    error: 'Something went wrong.',
                  }[status.state]}
              </p>
              <button type="button" className={buttonPrimary} onClick={() => setAttempt((value) => value + 1)}>
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          {running ? (
            <button type="button" className={buttonGhost} onClick={close}>
              Cancel
            </button>
          ) : (
            <button type="button" className={buttonGhost} onClick={close}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
