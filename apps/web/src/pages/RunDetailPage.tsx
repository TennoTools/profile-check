import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type CheckProgress, dateFormat, numberFormat } from '@tennotools/profile-check-core/web';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiDown } from '../components/ApiDown';
import { Card } from '../components/Card';
import { ChecksList } from '../components/ChecksList';
import { buttonGhost, buttonPrimary, labelClass } from '../components/controls';
import { ProfileCard } from '../components/ProfileCard';
import { RunProgress } from '../components/RunProgress';
import { StatusPill } from '../components/StatusPill';
import { VerdictBanner } from '../components/VerdictBanner';
import { fetchRun, startRun } from '../lib/api';
import { subscribeToRun } from '../lib/sse';

export function RunDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<CheckProgress[]>([]);
  const [rerunning, setRerunning] = useState(false);

  const runQuery = useQuery({
    queryKey: ['run', id],
    queryFn: () => fetchRun(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      // polling fallback while SSE is connected anyway
      const data = query.state.data;
      return data && (data.state === 'queued' || data.state === 'running') ? 1_500 : false;
    },
  });

  const runState = runQuery.data?.state;

  useEffect(() => {
    if (!id || runState === 'done' || runState === 'failed') return;
    setProgress([]);
    const source = subscribeToRun(id, {
      onProgress: (item) => setProgress((previous) => [...previous, item]),
      onDone: () => void queryClient.invalidateQueries({ queryKey: ['run', id] }),
      onServerError: () => void queryClient.invalidateQueries({ queryKey: ['run', id] }),
    });
    return () => source.close();
  }, [id, runState, queryClient]);

  if (runQuery.isLoading) {
    return (
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="tt-spinner" /> Loading run…
      </div>
    );
  }
  if (runQuery.isError) {
    return (
      <Card title="Run">
        <ApiDown onRetry={() => runQuery.refetch()} />
        <Link to="/runs" className="mt-4 inline-block text-xs text-accent underline">
          ← Back to history
        </Link>
      </Card>
    );
  }

  const run = runQuery.data;
  if (!run) return null;
  const running = run.state === 'queued' || run.state === 'running';

  const rerun = async (): Promise<void> => {
    setRerunning(true);
    try {
      const { id: newId } = await startRun({
        platform: run.request.platform,
        accountId: run.request.accountId,
        useProxy: run.request.useProxy,
      });
      void queryClient.invalidateQueries({ queryKey: ['runs'] });
      navigate(`/runs/${newId}`);
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/runs" className="text-xs font-black uppercase tracking-[0.14em] text-muted hover:text-ink">
          ← History
        </Link>
        <span className="flex items-center gap-2 text-xs text-muted">
          <StatusPill value={run.verdict ?? run.state} />
          <span className="font-mono">{id.slice(0, 8)}</span>
        </span>
      </div>

      {running ? <RunProgress progress={progress} /> : null}
      {!running ? <VerdictBanner run={run} /> : null}

      {run.error ? (
        <Card title="Error" sub={run.error.type}>
          <p className="whitespace-pre-wrap text-sm text-danger">{run.error.message}</p>
          {run.error.bodySnippet ? (
            <pre className="mt-3 overflow-auto rounded border border-panel-border bg-black/60 p-3 text-xs text-muted">
              {run.error.bodySnippet}
            </pre>
          ) : null}
        </Card>
      ) : null}

      {run.summary ? <ProfileCard run={run} /> : null}
      {run.checks.length > 0 ? <ChecksList checks={run.checks} /> : null}

      {run.source ? (
        <Card title="Technical info" sub="source request">
          <div className="grid grid-cols-1 gap-x-7 gap-y-4 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <span className={labelClass}>Source URL</span>
              <span className="break-all font-mono text-xs text-ink">{run.source.url}</span>
            </div>
            <div>
              <span className={labelClass}>Via</span>
              <span className="text-ink">{run.source.via}</span>
            </div>
            <div>
              <span className={labelClass}>Duration</span>
              <span className="text-ink">
                {run.source.durationMs != null ? `${numberFormat.format(run.source.durationMs)} ms` : '—'}
              </span>
            </div>
            <div>
              <span className={labelClass}>Size</span>
              <span className="text-ink">
                {run.source.sizeBytes != null ? `${numberFormat.format(run.source.sizeBytes)} bytes` : '—'}
              </span>
            </div>
            <div>
              <span className={labelClass}>XP cache expiry</span>
              <span className="text-ink">
                {run.source.xpCacheExpiryDate
                  ? `${dateFormat.format(new Date(run.source.xpCacheExpiryDate))} — wait for expiry before retrying`
                  : '—'}
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <button type="button" className={buttonPrimary} onClick={() => void rerun()} disabled={rerunning || running}>
          {rerunning ? 'Starting…' : 'Re-run'}
        </button>
        <Link to="/" className={buttonGhost}>
          New check
        </Link>
      </div>
    </div>
  );
}
