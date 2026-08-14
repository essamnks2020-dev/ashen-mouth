import * as THREE from 'three';
import { lerp, clamp01, damp } from '../core/util.js';
import { toggleLight } from '../world/house.js';
import { GRATE, SPAWN, MAIN_STAIR } from '../world/plan.js';

const INTRO = [
  { t: 0.0, pos: [7.4, 2.15, 16.8], look: [0.1, 3.4, 2.2], card: '14 ASHEN LANE', line: 'The Holloway house. Tomorrow the sign goes up.' },
  { t: 5.5, pos: [1.4, 1.62, 12.4], look: [0.05, 2.1, 5.4], card: '', line: 'You have the key. Mother said: go in, close the flue, do not stay after dark.' },
  { t: 11.0, pos: [0.05, 1.55, 7.35], look: [0, 1.45, 5.15], card: '', line: 'The door still knows your hand.' },
  { t: 15.5, pos: [-0.35, 1.56, 4.35], look: [-1.2, 1.4, 4.6], card: '', line: 'This is the house you grew up in. The clock still keeps her time.' },
  { t: 20.5, pos: [-3.4, 1.48, 2.85], look: [GRATE.x + 0.4, 0.75, GRATE.z], card: '', line: 'After Father died she burned every tape he recorded. She fed them to the grate.' },
  { t: 26.0, pos: [-0.4, 1.62, 3.9], look: [MAIN_STAIR.x, 1.8, MAIN_STAIR.zBot - 0.8], card: 'ASHEN MOUTH', line: 'Find her name. Take the damper from the cellar. Whisper it at the grate.' },
  { t: 31.0, pos: [SPAWN.x, 1.58, SPAWN.z], look: [SPAWN.x, 1.4, SPAWN.z - 2.4], card: '', line: 'Whisper if you must. Never shout.' },
  { t: 34.5, pos: [SPAWN.x, 1.58, SPAWN.z], look: [SPAWN.x, 1.4, SPAWN.z - 2.4], card: '', line: '' },
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

  skipIntro() { this.introT = 35; this.introDone = true; }

  intro(dt, cam) {
    this.introT += dt;
    const t = this.introT;
    if (t >= 34.2) { this.introDone = true; return { card: '', line: '' }; }
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

    const gp = level.gratePos || new THREE.Vector3(GRATE.x + 0.55, 0.7, GRATE.z);
    const atGrate = player.pos.distanceTo(gp) < 2.1 && this.zone === 'parlor';
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
    if (it.kind === 'drawer' || it.kind === 'cupboard') {
      if (it.anim) it.anim.want = it.anim.want > 0.5 ? 0 : 1;
      if (it.frag) this._learn(it.frag);
      this.inspect = { title: it.title, body: it.body || '' };
      this.inspectT = 5.5;
      emitSound(it.pos, 3.2, 'door');
      return;
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
