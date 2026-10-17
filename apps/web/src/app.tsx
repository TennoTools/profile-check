import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SetupGate } from './components/SetupGate';
import { CheckPage } from './pages/CheckPage';
import { HistoryPage } from './pages/HistoryPage';
import { InitPage } from './pages/InitPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Patient enough to ride out a dev-mode API boot (~2-3 s of retries).
      retry: 2,
      retryDelay: (attempt) => Math.min((attempt + 1) * 750, 4_000),
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* The wizard lives outside the Layout: no nav while the app is unconfigured. */}
          <Route path="init" element={<InitPage />} />
          <Route element={<SetupGate />}>
            <Route element={<Layout />}>
              <Route index element={<CheckPage />} />
              <Route path="runs" element={<HistoryPage />} />
              <Route path="runs/:id" element={<RunDetailPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
