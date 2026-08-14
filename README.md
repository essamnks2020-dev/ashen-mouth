# ASHEN MOUTH

A first-person listening-horror game in the browser. You return to **14 Ashen Lane**
the night before the house is sold. Your mother burned your father’s recordings
in the parlor grate. The house learned to listen. The grate is its mouth.

Silence is stealth. Your microphone is the threat and the tool.

> **Play online:** https://essamnks2020-dev.github.io/ashen-mouth/

---

## Running locally

Must be served over `http://` — browsers will not load ES modules from disk.

```bash
node serve.mjs                 # then open http://localhost:5173
```

```bash
python -m http.server 5173
```

Nothing to install. `npm install` is not required — three.js is vendored.

**Requires WebGL2.** If it runs rough, drop to MEDIUM or LOW in Settings.

---

## How to play

| Input | Action |
| --- | --- |
| `W A S D` | Move |
| `SHIFT` | Slow walk (quieter) |
| `CTRL` / `C` | Crouch |
| `E` | Inspect / door / light / note |
| `F` | Flashlight |
| `T` | Known words |
| `V` / `B` / `N` | Whisper / speak / shout (if mic is off) |
| `1–9` | Whisper a known word (with T open) |
| `ESC` | Pause |
| Click | Lock mouse |

Read the house. Find **MA** (kitchen), **REN** (nursery), **MAREN** (parlor photograph),
and the **damper** in the cellar. Carry them to the parlor grate. Whisper **MAREN**.
Do not shout your own name.

The Listener does not hunt by sight. Hiding in the dark does nothing. Making noise
does everything.

---

## Architecture

```
index.html              importmap + HUD / menus
serve.mjs               tiny static server
vendor/three/           three.js r185
src/
  main.js               boot, loop, screens
  core/                 input, audio, voice, post
  world/                collision, materials, house
  game/                 player, listener, story, life
  ui/                   house CSS
```

MIT — see LICENSE. Bundles three.js (MIT). All rooms, the Listener, and systems
are original.
