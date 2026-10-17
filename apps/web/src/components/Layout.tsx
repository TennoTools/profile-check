import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { fetchHealth } from '../lib/api';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `text-xs font-black uppercase tracking-[0.18em] transition-colors ${
    isActive ? 'text-accent' : 'text-muted hover:text-ink'
  }`;

export function Layout() {
  const [logoBroken, setLogoBroken] = useState(false);
  const queryClient = useQueryClient();
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: 2,
    retryDelay: (attempt) => (attempt + 1) * 600,
    // Quiet while the API is up; fast polling while it is down so the UI
    // recovers on its own the moment the API answers again.
    refetchInterval: (query) => (query.state.status === 'error' ? 4_000 : 30_000),
  });
  const offline = healthQuery.isError;
  const wasOffline = useRef(false);

  useEffect(() => {
    if (offline) {
      wasOffline.current = true;
    } else if (wasOffline.current && healthQuery.isSuccess) {
      wasOffline.current = false;
      void queryClient.invalidateQueries();
    }
  }, [offline, healthQuery.isSuccess, queryClient]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4">
      {offline ? (
        <div className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-center text-xs text-danger">
          <span className="font-black uppercase tracking-[0.14em]">Local API offline</span> — 127.0.0.1:8787 is not
          responding. Waiting for it to come back…
        </div>
      ) : null}
      <header className="pb-6 pt-12 text-center">
        {logoBroken ? (
          <div className="mb-4 text-4xl font-black tracking-[0.18em] text-accent uppercase">TennoTools</div>
        ) : (
          <img
            src="/assets/tennotools_logo.png"
            alt="TennoTools"
            className="mx-auto mb-4 w-52 drop-shadow-[0_0_24px_rgba(255,255,255,0.85)] transition hover:scale-[1.04] hover:drop-shadow-[0_0_36px_rgba(255,215,0,0.9)]"
            onError={() => setLogoBroken(true)}
          />
        )}
        <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">Profile Check — the parser canary</p>
        <nav className="mt-6 flex justify-center gap-8">
          <NavLink to="/" end className={navLinkClass}>
            Check
          </NavLink>
          <NavLink to="/runs" className={navLinkClass}>
            History
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 pb-16">
        <Outlet />
      </main>
      <footer className="border-t border-panel-border py-6 text-center text-[10px] uppercase tracking-[0.14em] text-muted">
        <a href="https://github.com/TennoTools" target="_blank" rel="noopener">
          TennoTools
        </a>{' '}
        — talks only to the local API (127.0.0.1), never directly to Digital Extremes
      </footer>
    </div>
  );
}
