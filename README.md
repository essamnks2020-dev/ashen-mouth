# TEMPER

**Cool the message before you send it.**

TEMPER is a local-first message forge. Paste the text you’re about to fire off — the angry reply, the breakup paragraph, the midnight Slack roast. Hot words glow. Absolutes flare. You quench, anneal, and breathe the heat down. When the plate is tempered, you copy it. Meaning stays. Scorch doesn’t.

> Not another AI rewrite chatbot. Intentional friction with a metallurgy interface.

---

## Running locally

Must be served over `http://` — browsers will not load ES modules from disk.

```bash
node serve.mjs                 # http://localhost:5173
```

```bash
npm run dev
```

Nothing to install. No accounts. No backend. Your words stay in `localStorage` on this device.

---

## How to use

| Move | What it does |
| --- | --- |
| Paste / type | Live heat score + glowing hot words |
| Tap a glowing word | Anneal it — pick a cooler phrase |
| Hold **Quench** | Dunk the whole plate; steam + hiss; heat falls |
| **Breath** (optional) | Blow toward the mic to cool |
| **Copy tempered** | Unlocks under the heat threshold |
| **Seal in vault** | Saves a cooled plaque locally |
| **Patterns** | Smith’s notes from your vault |

Try the molten samples on the enter screen if you want a fast demo.

---

## Product docs

- `DESIGN.md` — design card
- Case study is also in-app under **Case study**
- `AGENTS.md` — notes for Cursor Cloud agents

---

## Architecture

```
index.html          shell + screens
serve.mjs           tiny static server
src/
  main.js           navigation, forge UX
  heat.js           on-device heat lexicon + structure
  forge.js          canvas atmosphere (embers, steam, thermometer)
  audio.js          procedural quench / ting / drone
  breath.js         optional mic RMS cooling
  vault.js          localStorage plaques + patterns
  ui/styles.css     charcoal / molten / quench visual system
```

MIT — see LICENSE.
