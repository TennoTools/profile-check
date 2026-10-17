import type { RunResult } from '@tennotools/profile-check-core/web';

export function VerdictBanner({ run }: { run: RunResult }) {
  if (run.state === 'failed') {
    return (
      <div className="rounded-xl border border-danger/40 bg-danger/10 px-5 py-4 text-sm font-semibold text-danger">
        ✗ Run failed — {run.error?.message ?? 'unknown error'}
      </div>
    );
  }
  if (!run.verdict) return null;

  const failed = run.checks.filter((check) => !check.ok);
  const criticalFailed = failed.filter((check) => check.critical);

  const view = {
    ok: {
      icon: '✓',
      text: 'THE PARSER WORKS PERFECTLY — all checks passed on live data.',
      cls: 'border-ok/40 bg-ok/10 text-ok',
    },
    warnings: {
      icon: '⚠',
      text: `THE PARSER WORKS — ${failed.length} non-blocking warning(s).`,
      cls: 'border-warn/40 bg-warn/10 text-warn',
    },
    broken: {
      icon: '✗',
      text: `THE PARSER LOOKS BROKEN — ${criticalFailed.length} critical field(s) missing or invalid. Report it: github.com/WFCD/profile-parser/issues`,
      cls: 'border-danger/40 bg-danger/10 text-danger',
    },
  }[run.verdict];

  return (
    <div className={`rounded-xl border px-5 py-4 text-sm font-semibold ${view.cls}`}>
      {view.icon} {view.text}
    </div>
  );
}
