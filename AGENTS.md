# AGENTS.md

## Cursor Cloud specific instructions

- Root serves the **portfolio** plus two apps. Run `node serve.mjs` (port **5173**).
- URLs: `/` portfolio · `/ashen-mouth/` game · `/temper/` forge
- No dependency install required for any of the three.
- Game needs WebGL2. TEMPER needs only a modern browser (mic optional).
- TEMPER QA: `window.__TEMPER` · Game QA: `window.__AM` with `?tour=1`
- Game fixes live under `ashen-mouth/src/world/` (kitchen, chimney, doors, stairs).
