# Homeport

A fishing logbook on the **fisherman’s** side — not just the regulator’s.

Offline-first trip ledger: haul → fuel/ice → crew share → **your profit**.
Live dock price board. Quota pressure before you ride the cap.

## Why this exists

Compliance apps (like Deckhand) keep you legal. Homeport makes the boat more money:
auto profit after fuel & crew, dock comparison, quota warnings.

## Run

From repo root: `node serve.mjs` → http://localhost:5173/homeport/

Or: `cd homeport && node ../serve.mjs` (same server).

## QA

`window.__HOMEPORT` — `.nav`, `.landDemo()`, `.state()`, `.reset()`

## Stack

Vanilla JS · localStorage · no backend · mobile-first phone shell
