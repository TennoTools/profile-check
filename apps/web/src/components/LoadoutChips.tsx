export function LoadoutChips({
  loadout,
}: {
  loadout: { warframe: string | null; primary: string | null; secondary: string | null; melee: string | null };
}) {
  const entries: Array<[string, string | null]> = [
    ['Warframe', loadout.warframe],
    ['Primary', loadout.primary],
    ['Secondary', loadout.secondary],
    ['Melee', loadout.melee],
  ];
  return (
    <div className="flex flex-wrap gap-3">
      {entries.map(([label, value]) => (
        <div
          key={label}
          className="flex min-w-[120px] flex-1 flex-col gap-0.5 rounded-[7px] border border-panel-border bg-black/50 px-3.5 py-2.5 sm:flex-none"
        >
          <span className="text-[10px] font-black uppercase tracking-[0.06em] text-muted">{label}</span>
          <span className="text-sm font-extrabold text-ink">{value ?? '—'}</span>
        </div>
      ))}
    </div>
  );
}
