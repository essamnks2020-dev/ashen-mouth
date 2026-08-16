# ASHEN MOUTH

A fully client-side, first-person WebGL horror game (Three.js, vanilla ES modules). No backend, no database, no build step. See `README.md` and `DESIGN.md` for gameplay and architecture.

## Cursor Cloud specific instructions

- Single service: a static HTTP server. There is no backend, no bundler, and no automated test suite.
- Run the dev server with `node serve.mjs` (equivalently `npm run dev` / `npm start`); it listens on port `5173`. Override with the `PORT` env var if needed.
- The game MUST be loaded over `http://` — ES modules will not load from `file://`. Open `http://localhost:5173/`.
- No dependency install is required: Three.js r185 is vendored under `vendor/three/`. `npm install` is a no-op (there are no runtime deps; any generated `package-lock.json` is gitignored).
- Requires a WebGL2-capable browser. If rendering is rough, lower quality to MEDIUM/LOW in the in-game Settings.
- Microphone + Web Speech API power the voice-stealth mechanic but are optional; keyboard fallbacks work without a mic (`V` whisper, `B` speak, `N` shout).
- Automated playthrough hook: load `http://localhost:5173/?tour=1` to expose `window.__AM` (`.ready`, `.mode()`, `.state()`) for scripted QA/tours.
- `scripts/record-playthrough.mjs` is Windows-specific QA tooling (hardcoded Chrome/ffmpeg paths) and is not part of normal dev/test on Linux.
