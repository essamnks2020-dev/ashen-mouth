# Outset

**Between home and the world.**

Outset is the calm minute before you leave — destination weather, when to walk out the door, and a pack list that knows *this* day. Not another todo app. A departure companion.

## Run

```bash
node serve.mjs
# → http://localhost:5173/outset/
```

Local-first. Storage: `outset.v1`.

## Brand (custom, no emoji)

- Logo: `src/assets/logo.svg`
- Cover: `src/assets/cover.svg`
- Icons: `src/ui/icons.js` — stroke SVG system for pack, weather, travel, chrome

## Ritual

Wake → Home (countdown + briefing) → Out (mode + weather) → Pack → Go (seal)

## QA

```js
window.__OUTSET.landDemo()
window.__OUTSET.reset()
```
