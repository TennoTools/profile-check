import { useState } from 'react';
import { buttonPrimary } from './controls';

/** Inline "local API not responding" block with a retry button (pages wrap it in a Card). */
export function ApiDown({ onRetry }: { onRetry: () => unknown }) {
  const [retrying, setRetrying] = useState(false);

  const retry = async (): Promise<void> => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-danger">The local API (127.0.0.1:8787) is not responding.</p>
      <p className="mt-2 text-xs text-muted">
        In dev, keep <code className="text-accent">npm run dev</code> running and wait for{' '}
        <code className="text-accent">TennoTools API ready</code> in the api terminal. This page recovers on its own
        once the API answers.
      </p>
      <button type="button" className={`${buttonPrimary} mt-4`} onClick={() => void retry()} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry now'}
      </button>
    </div>
  );
}
