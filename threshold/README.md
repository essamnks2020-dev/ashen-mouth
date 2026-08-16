# THRESHOLD

The last thirty seconds before you leave home.

Not a todo app. A **departure ritual**: weather at your destination vs home, leave-by from the next place on your day, a checklist that knows Tuesday is gym day — then you open the door and seal it.

## Run

From the repo root:

```bash
node serve.mjs
# → http://localhost:5173/threshold/
```

Local-first. No backend. No account. Storage key: `threshold.v1`.

## Ritual flow

1. **Wake** — brand + doorway
2. **Home** — next event, leave-by, stoop weather
3. **Out** — pick destination, compare weather, confirm leave-by
4. **Pack** — day- and weather-aware checklist
5. **Go** — open the door, seal the departure

## QA

```js
window.__THRESHOLD.begin()
window.__THRESHOLD.checkAll()
window.__THRESHOLD.seal()
window.__THRESHOLD.landDemo()  // full happy path
window.__THRESHOLD.reset()
```

## Docs

- `DESIGN.md` — visual / motion system
- `CASE-STUDY.md` — why this product
