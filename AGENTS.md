# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus apps. Run `node serve.mjs` (port **5173**).
- URLs:
  - `/` — portfolio
  - `/threshold/` — **THRESHOLD** departure ritual (lead product)
  - `/ashen-mouth/` — ASHEN MOUTH game
  - `/homeport/` — Homeport (archive)
  - `/temper/` — TEMPER forge (archive)
- No dependency install required (`package.json` has no runtime deps). Optional: `npm install` is a no-op-safe refresh if a lockfile appears later.
- **THRESHOLD** — mobile-first phone shell. QA: `window.__THRESHOLD` (`.begin()`, `.checkAll()`, `.seal()`, `.landDemo()`, `.reset()`, `.state()`, `.go(screen)`). Storage key `threshold.v1`. Weather is an on-device deterministic sketch (no API key).
- **Homeport** — QA: `window.__HOMEPORT`. Storage `homeport.v2`.
- **TEMPER** — QA: `window.__TEMPER`. Hash deep-links (`#forge`, …).
- **ASHEN MOUTH** — WebGL2 needs GPU Chrome (headless fails). QA: `window.__AM` + `?audit=1`. World under `ashen-mouth/src/world/`.
