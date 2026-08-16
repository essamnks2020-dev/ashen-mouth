# Homeport

A fishing logbook on the **fisherman’s** side — not just the regulator’s.

Offline-first trip ledger: haul → fuel/ice → crew share → **your profit**.
Live dock price board. Quota pressure before you ride the cap.
Steam scenarios: “what if I land at New Bedford instead?”

## Why this exists

Compliance apps (Deckhand, etc.) keep you legal. Homeport makes the boat more money.
With **zero capital**, this beats marketplaces and vet networks: one skipper downloads and gets value alone.

## Run

From repo root:

```bash
node serve.mjs
```

→ http://localhost:5173/homeport/

## Product surface

| Screen | What |
| --- | --- |
| Wake | Brand + open log / demo land |
| Bridge | Last trip profit, season goal, quota pressure |
| Trip | 3-step wizard + dock scenario before landing |
| Docks | $/lb board + steam-cost scenarios |
| Ledger | Season stats + full quota + history |
| Vessel | Crew share, fuel burn, season goal |

## QA

```js
window.__HOMEPORT.nav('bridge')
window.__HOMEPORT.landDemo()
window.__HOMEPORT.state()
window.__HOMEPORT.reset()
```

## Stack

Vanilla JS · localStorage (`homeport.v2`) · no backend · mobile-first phone shell

See `DESIGN.md` and `CASE-STUDY.md`.
