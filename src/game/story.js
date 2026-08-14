import * as THREE from 'three';
import { lerp, clamp01, damp } from '../core/util.js';
import { toggleLight } from '../world/house.js';

const INTRO = [
  { t: 0.0, pos: [0.0, 1.6, 14.8], look: [0, 2.4, 6.4], card: '14 ASHEN LANE', line: 'The Holloway house. The night before they sell it.' },
  { t: 5.5, pos: [0.2, 1.55, 9.2], look: [0, 1.7, 5.8], card: '', line: 'You have a key. You were told not to stay after dark.' },
  { t: 11.0, pos: [0.15, 1.55, 5.5], look: [-1.4, 1.6, 4.6], card: '', line: 'Your mother asked you not to speak in this house.' },
  { t: 16.5, pos: [-4.6, 1.45, 3.4], look: [-7.4, 0.9, 2.6], card: '', line: 'She burned Father’s tapes in the grate. Every word he recorded.' },
  { t: 22.5, pos: [5.4, 1.5, 3.6], look: [7.1, 1.15, 4.4], card: '', line: 'The tap still drips. The clock still keeps her time.' },
  { t: 28.0, pos: [-6.6, 1.05, 2.6], look: [-7.6, 0.7, 2.6], card: 'ASHEN MOUTH', line: 'The house learned to listen. Close the flue before morning.' },
  { t: 34.5, pos: [0.0, 1.62, 4.55], look: [0, 1.5, 1.2], card: '', line: 'Whisper if you must. Never shout.' },
  { t: 38.5, pos: [0.0, 1.62, 4.55], look: [0, 1.5, 1.2], card: '', line: '' },
];

export class Story {
  constructor() {
    this.fragments = { ma: false, ren: false, maren: false };
    this.hasDamper = false;
    this.known = [];
    this.introT = 0;
    this.introDone = false;
    this.end = null;
    this.endT = 0;
    this.woke = false;
    this.hint = 'You are in the house. Close the flue before morning.';
    this.inspect = null;
    this.inspectT = 0;
    this.zone = 'foyer';
    this.near = null;
    this.bindT = 0;
  }

  skipIntro() { this.introT = 39; this.introDone = true; }

  intro(dt, cam) {
    this.introT += dt;
    const t = this.introT;
    if (t >= 38.2) { this.introDone = true; return { card: '', line: '' }; }
    let a = INTRO[0], b = INTRO[INTRO.length - 1];
    for (let i = 0; i < INTRO.length - 1; i++) {
      if (t >= INTRO[i].t && t <= INTRO[i + 1].t) { a = INTRO[i]; b = INTRO[i + 1]; break; }
    }
    const u = clamp01((t - a.t) / Math.max(0.001, b.t - a.t));
    const s = u * u * (3 - 2 * u);
    cam.position.set(
      lerp(a.pos[0], b.pos[0], s),
      lerp(a.pos[1], b.pos[1], s),
      lerp(a.pos[2], b.pos[2], s),
    );
    cam.lookAt(
      lerp(a.look[0], b.look[0], s),
      lerp(a.look[1], b.look[1], s),
      lerp(a.look[2], b.look[2], s),
    );
    return { card: s < 0.82 ? a.card : b.card, line: s < 0.55 ? a.line : b.line };
  }

  zoneOf(p, zones) {
    let best = this.zone, bestY = 99;
    for (const [k, z] of Object.entries(zones)) {
      if (p.x < z.minx || p.x > z.maxx || p.z < z.minz || p.z > z.maxz) continue;
      const dy = Math.abs((z.y || 0) - p.y);
      if (dy < 1.6 && dy < bestY) { best = k; bestY = dy; }
    }
    return best;
  }

  update(dt, player, level, listener, voice, audio, emitSound, fx) {
    this.zone = this.zoneOf(player.pos, level.zones);
    if (!this.woke && (this.zone === 'parlor' || voice.mode !== 'silent' || player.moved > 2.4)) {
      this.woke = true;
      listener.wake();
      this.hint = 'Something in the house turned its head.';
    }

    this.inspectT = Math.max(0, this.inspectT - dt);
    if (this.inspectT <= 0) this.inspect = null;

    this.near = null;
    let best = 1.85;
    for (const it of level.interact) {
      const d = it.pos.distanceTo(player.pos);
      if (d < Math.min(best, it.reach || 1.7)) { best = d; this.near = it; }
    }

    if (this.zone === 'parlor') this.hint = this.fragments.maren || (this.fragments.ma && this.fragments.ren)
      ? (this.hasDamper ? 'The grate is waiting. Whisper MAREN.' : 'You still need the damper from the cellar.')
      : 'The grate is the mouth. Find her name in the house.';
    else if (this.zone === 'cellar') this.hint = this.hasDamper ? 'Take the damper upstairs to the parlor.' : 'The damper wheel is here. The iron is cold.';
    else if (this.zone === 'kitchen') this.hint = this.fragments.ma ? 'The tap keeps time. Check the parlor and the nursery.' : 'Drawers. A letter. She wrote in small words.';
    else if (this.zone === 'child') this.hint = this.fragments.ren ? 'You already wrote the last of her name.' : 'The drawing on the wall is yours.';
    else if (this.zone === 'foyer' && !this.woke) this.hint = 'Clock. Coat. Stairs. You can move. The house is awake enough.';
    else if (this.zone === 'master') this.hint = 'Her room still holds the shape of waiting.';

    if (this.end) {
      this.endT += dt;
      if (this.end === 'taken') fx.taken = Math.min(1, this.endT / 1.6);
      if (this.end === 'bind') { fx.pin = 0.8; fx.flash = 0.15; }
      return;
    }

    const atGrate = player.pos.distanceTo(new THREE.Vector3(-7.1, 0.7, 2.6)) < 2.1 && this.zone === 'parlor';
    const said = voice.flags.bound || (voice.flags.frag === 'maren');
    const know = this.fragments.maren || (this.fragments.ma && this.fragments.ren);
    if (atGrate && know && this.hasDamper && (said || (voice.mode === 'whisper' && this.known.includes('MAREN')))) {
      this.bindT += dt;
      listener.state = 'listen';
      fx.pin = 0.6;
      if (this.bindT > 1.6) {
        this.end = 'bind';
        this.endT = 0;
        audio?.bindChime?.();
      }
    } else this.bindT = Math.max(0, this.bindT - dt);

    if (voice.flags.self && voice.mode === 'shout') {
      listener.state = 'hunt';
      listener.huntT = 12;
      listener.lastHeard.copy(player.pos);
      this.hint = 'You said your name like you meant it. The house heard.';
    }

    if (listener.state === 'attack' && listener.attackT > 1.15) {
      this.end = 'taken';
      this.endT = 0;
      audio?.taken?.();
    }
  }

  use(player, audio, emitSound, listener, level) {
    const it = this.near;
    if (!it) return;
    audio?.inspect?.();
    if (it.kind === 'door') {
      const r = it.use(this, audio);
      this.hint = r?.hint || this.hint;
      emitSound(it.pos, 6, 'door');
      return;
    }
    if (it.kind === 'light') {
      const on = toggleLight(level, it.lightId);
      this.inspect = { title: it.title, body: on ? 'Warm light holds the room.' : 'The dark comes back in.' };
      this.inspectT = 2.2;
      emitSound(it.pos, 2.5, 'click');
      return;
    }
    if (it.kind === 'drawer' && it.mesh) {
      it.mesh.position.x -= 0.12;
      setTimeout(() => { if (it.mesh) it.mesh.position.x += 0.12; }, 900);
    }
    if (it.frag) this._learn(it.frag);
    if (it.kind === 'key' && !this.hasDamper) {
      this.hasDamper = true;
      this.hint = 'Damper in hand. Take it to the parlor grate.';
    }
    this.inspect = { title: it.title, body: it.body || '' };
    this.inspectT = 5.5;
    if (it.kind === 'grate' && this.fragments.maren && this.hasDamper) {
      this.hint = 'Whisper MAREN. Do not shout.';
    }
  }

  _learn(frag) {
    if (frag === 'ma') this.fragments.ma = true;
    if (frag === 'ren') this.fragments.ren = true;
    if (frag === 'maren') { this.fragments.maren = true; this.fragments.ma = true; this.fragments.ren = true; }
    if (this.fragments.ma && this.fragments.ren) this.fragments.maren = true;
    this.known = [];
    if (this.fragments.ma) this.known.push('MA');
    if (this.fragments.ren) this.known.push('REN');
    if (this.fragments.maren) this.known.push('MAREN');
  }
}
