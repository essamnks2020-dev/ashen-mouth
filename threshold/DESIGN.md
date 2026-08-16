# THRESHOLD — Design

## Feeling

Standing in a dark room with light spilling through a door frame. Warm inside, cooler or wetter beyond. Dust in the beam. The moment before you step out.

**Not** purple SaaS. **Not** a dashboard. **Not** a checklist clone with confetti.

## Palette

| Token | Role |
| --- | --- |
| Void / room (`#080706`, `#12100c`) | Interior dark |
| Salt (`#f6f1e6`) | Type |
| Ember (`#e0a84a`) | Threshold light, CTAs, progress |
| Cool (`#7a9aab`) | Destination weather, rain spill |

## Type

- **Syne** — brand lockup
- **Cormorant Garamond** — display / lede / temps
- **Sora** — UI

## Motion

- Screen enter: rise + blur dissolve
- Door glyph breathe on wake
- Checklist pop on check
- Seal door: leaf swings on open (`perspective` + `rotateY`)
- Atmosphere canvas: light spill pulse, dust motes, rain beyond the frame
- Respect `prefers-reduced-motion`

## Shell

Phone frame on desktop; full-bleed on small viewports. Status strip mirrors a device clock + ritual step.
