import { useState } from 'react';

/** TennoTools logo and tagline, with a text fallback when the image is missing. */
export function Brand() {
  const [logoBroken, setLogoBroken] = useState(false);
  return (
    <>
      {logoBroken ? (
        <div className="mb-4 text-4xl font-black tracking-[0.18em] text-accent uppercase">TennoTools</div>
      ) : (
        <img
          src="/assets/tennotools_logo.png"
          alt="TennoTools"
          className="mx-auto mb-4 w-52 drop-shadow-[0_0_24px_rgba(255,255,255,0.85)] transition hover:scale-[1.04] hover:drop-shadow-[0_0_36px_rgba(255,215,0,0.9)]"
          onError={() => setLogoBroken(true)}
        />
      )}
      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-muted">Profile Check — the parser canary</p>
    </>
  );
}
