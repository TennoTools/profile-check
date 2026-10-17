import type { ReactNode } from 'react';

export function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <article className="overflow-hidden rounded-xl border border-panel-border bg-panel shadow-[0_20px_60px_rgba(0,0,0,0.7)]">
      <div className="flex items-center justify-between border-b border-panel-border bg-accent/5 px-5 py-3">
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-accent">{title}</span>
        {sub ? <span className="text-[10px] font-semibold tracking-[0.06em] text-muted">{sub}</span> : null}
      </div>
      <div className="px-5 py-5">{children}</div>
    </article>
  );
}
