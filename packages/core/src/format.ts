/** Shared formatting helpers (en-US), also reused by the web client. */

export const numberFormat = new Intl.NumberFormat('en-US');

export const dateFormat = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(+value);
}

/** `177450 s` → `2 d 1 h 17 min` (v1 formatting, kept for parity). */
export function formatDuration(seconds: unknown): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return 'unknown';
  const [days, hours, minutes] = [seconds / 86_400, (seconds % 86_400) / 3_600, (seconds % 3_600) / 60].map(
    Math.floor,
  ) as [number, number, number];
  const parts: string[] = [];
  if (days > 0) parts.push(`${numberFormat.format(days)} d`);
  if (days > 0 || hours > 0) parts.push(`${hours} h`);
  parts.push(`${minutes} min`);
  return parts.join(' ');
}
