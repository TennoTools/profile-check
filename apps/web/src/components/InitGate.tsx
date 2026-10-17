import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { fetchSettings } from '../lib/api';
import { initSkipped, needsSetup } from '../lib/setup';
import { CheckPage } from '../pages/CheckPage';

/**
 * Home route: a brand-new install (no key, no AccountId) lands on the /init
 * wizard — unless it was skipped for this session. The Check page is rendered
 * while settings load (and when the API is down) so it keeps its own
 * spinner/ApiDown handling.
 */
export function InitGate() {
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  if (settingsQuery.isSuccess && needsSetup(settingsQuery.data) && !initSkipped()) {
    return <Navigate to="/init" replace />;
  }
  return <CheckPage />;
}
