import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet } from 'react-router-dom';
import { fetchSettings } from '../lib/api';
import { initSkipped, needsSetup } from '../lib/setup';

/**
 * App-wide first-run gate: while nothing is configured (no ScraperAPI key and
 * no AccountId) every page — Check, History, Settings — redirects to /init,
 * unless the wizard was skipped for this browser session.
 *
 * It sits *above* the Layout, and settings are awaited behind a minimal
 * spinner, so a brand-new install never sees the app chrome (nav included)
 * before the wizard. When the API is down the pages render instead, letting
 * the offline banner do its job.
 */
export function SetupGate() {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  if (settingsQuery.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-panel-border border-t-accent" />
      </div>
    );
  }
  if (settingsQuery.isSuccess && needsSetup(settingsQuery.data) && !initSkipped()) {
    return <Navigate to="/init" replace />;
  }
  return <Outlet />;
}
