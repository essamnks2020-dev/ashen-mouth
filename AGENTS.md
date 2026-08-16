# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus apps. Run `node serve.mjs` (port **5173**).
- URLs:
  - `/` — portfolio
  - `/homeport/` — Homeport v2 (fishing logbook)
  - `/ashen-mouth/` — ASHEN MOUTH game
  - `/temper/` — TEMPER forge
- No dependency install required.
- **Homeport** — mobile-first phone shell. QA: `window.__HOMEPORT` (`.nav`, `.landDemo()`, `.state()`, `.reset()`). Storage key `homeport.v2`. Offline-first.
- **TEMPER** — QA: `window.__TEMPER`. Hash deep-links (`#forge`, …).
- **ASHEN MOUTH** — WebGL2 needs GPU Chrome (headless fails). QA: `window.__AM` + `?tour=1`. World under `ashen-mouth/src/world/`.
