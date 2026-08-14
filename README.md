# ASHEN MOUTH

A first-person listening-horror game in the browser. A coastal radio-monastery
is built into a basalt stack. The monks bound a saint into the rock so storms
would spare the boats. The saint still listens. It learned speech from prayers
and distress calls. It now answers.

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
| `E` | Inspect / door / bell |
| `F` | Lantern |
| `T` | Known sounds |
| `V` / `B` / `N` | Whisper / speak / shout (if mic is off) |
| `1–9` | Whisper a known name (with T open) |
| `ESC` | Pause |
| Click | Lock mouse |

Find three true sounds (mural, ledger, vinyl) and the stilling fork. Carry them
to the Mouth. Whisper **ORTHAEL**. Do not shout your own name.

The saint does not hunt by sight. Hiding in the dark does nothing. Making noise
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
  world/                collision, shaders, monastery
  game/                 player, saint, story, motes
  ui/                   liturgical CSS
```

MIT — see LICENSE. Bundles three.js (MIT). All rooms, the saint, and systems
are original.
