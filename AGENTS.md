# AGENTS.md

## Cursor Cloud specific instructions

- Single service: static HTTP via `node serve.mjs` (or `npm run dev`) on port **5173** (`PORT` env overrides).
- No dependency install required — vanilla ES modules, no bundler, no backend.
- Open `http://localhost:5173/`. ES modules will not load from `file://`.
- Core demo path: Enter → try a molten sample → tap glowing words to anneal → hold **Quench** until **Copy tempered** unlocks → **Seal in vault** → check **Patterns**.
- Optional mic breath cooling needs `getUserMedia`; keyboard/mouse quench works without it.
- QA hook: `window.__TEMPER` with `.setText()`, `.nav()`, `.state()`, `.analyze()`.
- Visual atmosphere uses a full-viewport canvas; `prefers-reduced-motion` is respected.
