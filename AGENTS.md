# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus apps. Run `node serve.mjs` (port **5173**).
- URLs:
  - `/` — portfolio
  - `/outset/` — **Outset** departure companion (lead product)
  - `/threshold/` — redirects to `/outset/`
  - `/ashen-mouth/` — ASHEN MOUTH game
  - `/homeport/` — Homeport (archive)
  - `/temper/` — TEMPER forge (archive)
- No dependency install required. Optional: `npm install` is a safe no-op refresh.
- **Outset** — milk/sage phone shell. QA: `window.__OUTSET` (alias `window.__THRESHOLD`) — `.begin()`, `.checkAll()`, `.seal()`, `.landDemo()`, `.reset()`, `.setMode('walk'|'transit'|'drive'|'bike')`, `.state()`, `.go(screen)`. Storage `outset.v1` (migrates `threshold.v1`). Weather is on-device sketch (no API key). After seal, UI returns to **home** (“Back to my day”). Pack has **Leave anyway** to record misses. Settings: remove routines, edit travel minutes, leave reminders while the tab is open.
- **Homeport** — QA: `window.__HOMEPORT`. Storage `homeport.v2`.
- **TEMPER** — QA: `window.__TEMPER`.
- **ASHEN MOUTH** — WebGL2 needs GPU Chrome (headless fails). QA: `window.__AM` + `?audit=1`.
