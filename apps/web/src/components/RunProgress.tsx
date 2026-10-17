import type { CheckProgress } from '@tennotools/profile-check-core/web';
import { Card } from './Card';

const STEPS = [
  { key: 'fetch', label: 'Fetching the profile from Digital Extremes' },
  { key: 'parse', label: 'Parsing profile data' },
  { key: 'validate', label: 'Running the 13 checks' },
  { key: 'persist', label: 'Saving the result' },
] as const;

export function RunProgress({ progress }: { progress: CheckProgress[] }) {
  const last = progress.at(-1);
  const currentIndex = last ? STEPS.findIndex((step) => step.key === last.step) : 0;

  return (
    <Card title="Run in progress" sub="live via SSE">
      <ul className="space-y-2.5">
        {STEPS.map((step, index) => (
          <li key={step.key} className="flex items-center gap-3 text-sm">
            {index < currentIndex ? (
              <span className="flex-none font-black text-ok">✓</span>
            ) : index === currentIndex ? (
              <span className="tt-spinner" />
            ) : (
              <span className="flex-none text-muted">•</span>
            )}
            <span className={index <= currentIndex ? 'text-ink' : 'text-muted'}>{step.label}</span>
            {step.key === 'fetch' && last?.step === 'fetch' && last.detail ? (
              <span className="truncate text-xs text-muted">{last.detail}</span>
            ) : null}
            {step.key === 'persist' && last?.step === 'persist' ? (
              <span className="text-xs text-muted">
                {last.passed ?? 0} passed / {last.failed ?? 0} failed
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
