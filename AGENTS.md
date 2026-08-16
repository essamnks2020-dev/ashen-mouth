# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus two apps. Run `node serve.mjs` (port **5173**).
- URLs: `/` portfolio · `/ashen-mouth/` game · `/temper/` forge
- No dependency install required for any of the three.
- Game needs WebGL2 (desktop/GPU Chrome — headless Chrome will fail WebGL context). TEMPER needs only a modern browser (mic optional).
- TEMPER QA: `window.__TEMPER` (`.nav`, `.setText`, `.quench`, `.state`) · hash deep-links work (`#forge`, `#vault`, …)
- Game QA: `window.__AM` with `?tour=1`
- Game world upgrades live under `ashen-mouth/src/world/` (kitchen L-run, chimney flue/smoke, doors, stairs).
