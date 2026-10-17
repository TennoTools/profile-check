import { PLATFORMS, type Platform } from '@tennotools/profile-check-core/web';

/** Segmented buttons for the platform (more discoverable than a dropdown). */
export function PlatformSelect({
  value,
  onChange,
  disabled,
}: {
  value: Platform;
  onChange: (platform: Platform) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset
      aria-label="Platform"
      className="m-0 flex min-w-0 flex-wrap gap-1 rounded-lg border border-panel-border bg-black/40 p-1"
    >
      {PLATFORMS.map((platform) => {
        const active = platform === value;
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onChange(platform)}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              active ? 'bg-accent text-black' : 'text-muted hover:text-ink'
            }`}
          >
            {platform}
          </button>
        );
      })}
    </fieldset>
  );
}
