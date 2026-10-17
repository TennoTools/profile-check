const STYLES: Record<string, string> = {
  ok: 'border-ok/40 text-ok bg-ok/10',
  warnings: 'border-warn/40 text-warn bg-warn/10',
  broken: 'border-danger/40 text-danger bg-danger/10',
  failed: 'border-danger/40 text-danger bg-danger/10',
  running: 'border-accent/40 text-accent bg-accent-dim',
  queued: 'border-panel-border text-muted bg-black/30',
  done: 'border-ok/40 text-ok bg-ok/10',
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
        STYLES[value] ?? STYLES.queued
      }`}
    >
      {value}
    </span>
  );
}
