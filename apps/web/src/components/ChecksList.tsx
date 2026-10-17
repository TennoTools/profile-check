import type { CheckResultDto } from '@tennotools/profile-check-core/web';
import { Card } from './Card';

export function ChecksList({ checks }: { checks: CheckResultDto[] }) {
  const passed = checks.filter((check) => check.ok).length;
  return (
    <Card title="Parsed-output checks" sub={`${passed}/${checks.length} passed`}>
      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 flex-none font-black ${
                check.ok ? 'text-ok' : check.critical ? 'text-danger' : 'text-warn'
              }`}
            >
              {check.ok ? '✓' : check.critical ? '✗' : '⚠'}
            </span>
            <span className="text-ink">
              {check.label}
              {check.detail ? <span className="text-muted"> — {check.detail}</span> : null}
            </span>
            {check.critical ? (
              <span className="ml-auto flex-none rounded border border-panel-border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em] text-muted">
                critical
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
