/** Shared page footer — same reassurance on every screen, wizard included. */
export function Footer() {
  return (
    <footer className="border-t border-panel-border py-6 text-center text-[10px] uppercase tracking-[0.14em] text-muted">
      <a href="https://github.com/TennoTools" target="_blank" rel="noopener">
        TennoTools
      </a>{' '}
      — talks only to the local API (127.0.0.1), never directly to Digital Extremes
    </footer>
  );
}
