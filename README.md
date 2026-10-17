<p align="center">
  <img src="docs/assets/screens/hero.png" alt="TennoTools — Profile Check" width="640" />
</p>

<h1 align="center">TennoTools Profile Check</h1>

<p align="center">
  <b>The Warframe profile-parser canary</b><br />
  Local live-check for the Warframe public profile endpoint — fetch a profile, parse it,<br />
  run 13 frozen validation checks, get a verdict.
</p>

<p align="center">
  <img alt="node ≥ 22.12" src="https://img.shields.io/badge/node-%E2%89%A5%2022.12-339933" />
  <img alt="TypeScript 7" src="https://img.shields.io/badge/TypeScript-7-3178C6" />
  <img alt="58 tests passing" src="https://img.shields.io/badge/tests-58%20passing-2ea44f" />
  <img alt="network — local-only" src="https://img.shields.io/badge/network-local--only-444444" />
  <img alt="docs — GitHub Pages" src="https://img.shields.io/badge/docs-GitHub%20Pages-ffd700" />
</p>

<p align="center">
  Project site &amp; docs — <a href="https://tennotools.github.io/profile-check/">tennotools.github.io/profile-check</a>
</p>

Local tool that verifies **live Warframe profile data** served by Digital Extremes still parses
correctly: fetch a profile by AccountId, parse it, run 13 frozen validation checks, show a verdict —
in a local web GUI (TennoTools theme) with run history.

## Documentation

The [project site](https://tennotools.github.io/profile-check/) is the single source of truth:

- **Home & quick start** — overview and the dev/production commands:
  [tennotools.github.io/profile-check/#quick-start](https://tennotools.github.io/profile-check/#quick-start)
- **Guide** — [first run & launcher](https://tennotools.github.io/profile-check/guide.html#first-run),
  [scripts](https://tennotools.github.io/profile-check/guide.html#scripts),
  [configuration](https://tennotools.github.io/profile-check/guide.html#config),
  [local API](https://tennotools.github.io/profile-check/guide.html#api) and
  [rules of engagement](https://tennotools.github.io/profile-check/guide.html#rules)
- **The 13 checks** — full list, verdict rules and frozen labels:
  [tennotools.github.io/profile-check/checks.html](https://tennotools.github.io/profile-check/checks.html)

## Screenshots

All screenshots on <a href="https://tennotools.github.io/profile-check/#screens">tennotools.github.io/profile-check/#screens</a>

## Architecture (npm workspaces, TypeScript everywhere)

```
packages/core    shared logic: platform hosts, DE fetch (+ScraperAPI fallback), typed parser
                 wrapper, the 13 checks, zod schemas, formatting — CLI-ready for a future re-add
apps/server      Fastify on 127.0.0.1:8787 · better-sqlite3 history (data/app.sqlite) ·
                 SSE live progress · Playwright Get-ID job · serves the built web app
apps/web         React 19 + Vite + Tailwind 4 GUI (black/gold TennoTools theme)
scripts/         check-once.ts — one-shot terminal check (parity / fixture capture)
                 launch.mjs — quick-launch logic behind launch.bat / launch.sh
docs/            static GitHub Pages site: landing, guide, the 13 checks (same theme, no external requests)
```

Everything is local-only: the server binds `127.0.0.1`, the ScraperAPI key never leaves the machine
(it lives in SQLite and is only echoed back masked), and there is no telemetry of any kind.

## Tests

```bash
npm test
```

- `packages/core/test` — 13-check labels/critical flags frozen, account-id heuristics, fetch
  semantics (fallback, timeouts, error explanations), zod schemas, plus an **offline parity test on a
  real DE response** captured in `packages/core/test/fixtures/profile.raw.json` (refresh with
  `npm run check:live`).
- `apps/server/test` — API integration: settings masking/seeding, run lifecycle persistence,
  SSE replay of terminal events.
- `apps/web/test` — API client regressions: body-less POSTs (account-id discover/cancel) must not
  send a JSON content-type (Fastify's empty-body 400), plus error-message extraction.

## Credits

Built on the community's work — the tools this project relies on:

- [`@wfcd/profile-parser`](https://github.com/WFCD/profile-parser) with
  [`warframe-worldstate-data`](https://github.com/WFCD/warframe-worldstate-data) — the parser and game
  data that Profile Check keeps honest.
- [`@wfcd/items`](https://github.com/WFCD/items) — item and loadout data used by the checks.
- [Fastify](https://fastify.dev), [React](https://react.dev), [Vite](https://vite.dev),
  [Tailwind CSS](https://tailwindcss.com), [Playwright](https://playwright.dev),
  [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) and [zod](https://zod.dev) — the local
  API, GUI and storage stack.
- [ImgBot](https://imgbot.net) — keeps every image in the repo (docs screenshots included) losslessly
  compressed; its `[ImgBot] Optimize images` pull requests are routine.

Profile Check is an independent community tool, not affiliated with Digital Extremes or WFCD.
