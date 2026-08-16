# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus apps. Run `node serve.mjs` (port **5173**).
- URLs: `/` portfolio · `/homeport/` fishing logbook · `/ashen-mouth/` game · `/temper/` forge
- No dependency install required for any of them.
- **Homeport** is mobile-first (phone shell on desktop). QA: `window.__HOMEPORT` (`.nav`, `.landDemo()`, `.state()`, `.reset()`). Offline-first · localStorage only.
- Game needs WebGL2 (desktop/GPU Chrome — headless Chrome will fail WebGL context). TEMPER needs only a modern browser (mic optional).
- TEMPER QA: `window.__TEMPER` · hash deep-links work (`#forge`, `#vault`, …)
- Game QA: `window.__AM` with `?tour=1`
- Game world upgrades live under `ashen-mouth/src/world/`
