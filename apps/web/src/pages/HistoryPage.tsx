import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiDown } from '../components/ApiDown';
import { Card } from '../components/Card';
import { buttonGhost } from '../components/controls';
import { StatusPill } from '../components/StatusPill';
import { fetchRuns } from '../lib/api';

const PAGE_SIZE = 20;

export function HistoryPage() {
  const [page, setPage] = useState(0);
  const runsQuery = useQuery({
    queryKey: ['runs', page],
    queryFn: () => fetchRuns(PAGE_SIZE, page * PAGE_SIZE),
  });

  const total = runsQuery.data?.total ?? 0;
  const items = runsQuery.data?.items ?? [];
  const maxPage = Math.max(Math.ceil(total / PAGE_SIZE) - 1, 0);

  return (
    <div className="space-y-6">
      <Card title="History" sub={`${total} run(s)`}>
        {runsQuery.isError ? (
          <ApiDown onRetry={() => runsQuery.refetch()} />
        ) : runsQuery.isLoading ? (
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="tt-spinner" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No runs yet —{' '}
            <Link to="/" className="text-accent underline">
              run your first check
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.12em] text-muted">
                  <th className="pb-2 pr-3 font-black">When</th>
                  <th className="pb-2 pr-3 font-black">Player</th>
                  <th className="pb-2 pr-3 font-black">Platform</th>
                  <th className="pb-2 pr-3 font-black">MR</th>
                  <th className="pb-2 pr-3 font-black">Result</th>
                  <th className="pb-2 font-black">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border/60">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-accent/5">
                    <td className="py-2.5 pr-3 text-xs text-muted">
                      <Link to={`/runs/${item.id}`} className="hover:text-ink">
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link to={`/runs/${item.id}`} className="font-semibold text-ink hover:text-accent">
                        {item.nickname ?? `${item.accountId.slice(0, 10)}…`}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 text-xs uppercase text-muted">{item.platform}</td>
                    <td className="py-2.5 pr-3 text-xs text-muted">{item.masteryRank ?? '—'}</td>
                    <td className="py-2.5 pr-3">
                      <StatusPill value={item.verdict ?? item.state} />
                    </td>
                    <td className="py-2.5 text-xs text-muted">
                      {item.elapsedMs != null ? `${item.elapsedMs} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className={buttonGhost}
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
          >
            ← Newer
          </button>
          <span className="text-xs text-muted">
            Page {page + 1} / {maxPage + 1}
          </span>
          <button
            type="button"
            className={buttonGhost}
            disabled={page >= maxPage}
            onClick={() => setPage((current) => current + 1)}
          >
            Older →
          </button>
        </div>
      </Card>
    </div>
  );
}
