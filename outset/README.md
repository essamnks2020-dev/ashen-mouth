# Outset

**Leave light. Arrive ready.**

The last thirty seconds before you leave — milky daylight UI, destination weather, live leave-by countdown, travel modes, smart pack presets, streaks, and a door that seals the departure.

## Run

```bash
node serve.mjs
# → http://localhost:5173/outset/
```

Local-first. No backend. Storage: `outset.v1` (migrates from `threshold.v1`).

## Ritual

1. **Wake** — cover + logo
2. **Home** — streak, countdown ring, briefing, week glance
3. **Out** — travel mode, destination, weather split, layer hint
4. **Pack** — presets + day/weather-aware checklist
5. **Go** — open the door, seal, copy “I'm leaving”

## Brand

- Logo: `src/assets/logo.svg`
- Cover: `src/assets/cover.svg`

## QA

```js
window.__OUTSET.begin()
window.__OUTSET.checkAll()
window.__OUTSET.seal()
window.__OUTSET.landDemo()
window.__OUTSET.reset()
```

(`window.__THRESHOLD` is an alias.)
