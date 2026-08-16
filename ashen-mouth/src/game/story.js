import * as THREE from 'three';
import { lerp, clamp01, damp } from '../core/util.js';
import { toggleLight } from '../world/house.js';
import { GRATE, SPAWN, MAIN_STAIR } from '../world/plan.js';

const INTRO = [
  { t: 0.0, pos: [9.4, 2.15, 18.4], look: [0.1, 3.2, 2.6], card: '14 ASHEN LANE', line: 'They put the sale board up in the morning. Tonight the house is still ours.' },
  { t: 5.8, pos: [4.2, 1.68, 15.1], look: [0.05, 2.2, 6.0], card: '', line: 'Mother pressed the key into my hand. Close the flue, she said. Do not stay after dark.' },
  { t: 11.2, pos: [0.55, 1.52, 12.4], look: [0.04, 1.7, 6.4], card: '', line: 'The brick path still finds my feet. Same cracks. Same weeds in the joints.' },
  { t: 16.4, pos: [0.08, 1.48, 9.15], look: [0, 1.55, 5.45], card: '', line: 'The porch lamp never went out. She left it for someone who was not coming back.' },
  { t: 21.2, pos: [0.02, 1.46, 7.05], look: [0, 1.42, 5.18], card: '', line: 'The door remembers the weight of my hand. The wood has gone grey at the latch.' },
  { t: 26.4, pos: [-0.38, 1.52, 4.7], look: [-0.15, 1.5, 2.1], card: '', line: 'Clock. Coat. Stairs. The house smells like the last winter she spent here.' },
  { t: 32.0, pos: [-3.2, 1.44, 3.1], look: [GRATE.x + 0.45, 0.78, GRATE.z], card: '', line: 'After Father died she burned every tape in that grate. She thought fire would make him quiet.' },
  { t: 38.2, pos: [-0.32, 1.56, 3.65], look: [MAIN_STAIR.x, 2.05, MAIN_STAIR.zBot - 0.5], card: 'ASHEN MOUTH', line: 'Find her name in the rooms. Take the damper from the cellar. Whisper it at the mouth.' },
  { t: 43.4, pos: [SPAWN.x, 1.56, SPAWN.z], look: [SPAWN.x, 1.32, SPAWN.z - 2.15], card: '', line: 'If you must speak, speak small. The house has been listening since she fed it his voice.' },
  { t: 48.0, pos: [SPAWN.x, 1.56, SPAWN.z], look: [SPAWN.x, 1.32, SPAWN.z - 2.15], card: '', line: '' },
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
    this.hint = 'You are in. Close the flue before morning.';
    this.inspect = null;
    this.inspectT = 0;
    this.zone = 'foyer';
    this.near = null;
    this.bindT = 0;
  }

  skipIntro() { this.introT = 49; this.introDone = true; }

  intro(dt, cam) {
    this.introT += dt;
    const t = this.introT;
    if (t >= 47.6) { this.introDone = true; return { card: '', line: '' }; }
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
    return { card: s < 0.78 ? a.card : b.card, line: s < 0.52 ? a.line : b.line };
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
      this.hint = 'Something in the parlor turned.';
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
      ? (this.hasDamper ? 'The grate is waiting. Whisper MAREN. Small.' : 'You still need the damper. Cellar, under the kitchen.')
      : 'The grate is the mouth. Her name is somewhere in this house.';
    else if (this.zone === 'cellar') this.hint = this.hasDamper ? 'Upstairs. Parlor. The mouth will not close without this.' : 'The damper wheel. Cold even through the gloves she left.';
    else if (this.zone === 'kitchen') this.hint = this.fragments.ma ? 'The tap still keeps time. Nursery. Parlor. The rest of her name.' : 'Drawers. A letter she never posted.';
    else if (this.zone === 'child') this.hint = this.fragments.ren ? 'You already wrote the end of it. You were small enough then.' : 'The drawing on the wall is yours.';
    else if (this.zone === 'foyer' && !this.woke) this.hint = 'Clock. Coat. Stairs. You can move. The house is only just waking.';
    else if (this.zone === 'master') this.hint = 'Her room still holds the shape of waiting.';
    else if (this.zone === 'dining') this.hint = 'Four chairs. Dust on the one that faced the parlor door.';
    else if (this.zone === 'landing') this.hint = 'From here the chimney sounds like someone breathing through iron.';
    else if (this.zone === 'porch') this.hint = 'Go in. The flue will not close from out here.';

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
      // Close the damper as the whisper takes
      if (level.grate?.userData) {
        level.grate.userData.damperOpen = Math.max(0, 1 - this.bindT / 1.6);
      }
      if (this.bindT > 1.6) {
        this.end = 'bind';
        this.endT = 0;
        if (level.grate?.userData) level.grate.userData.damperOpen = 0;
        audio?.bindChime?.();
      }
    } else this.bindT = Math.max(0, this.bindT - dt);

    if (voice.flags.self && voice.mode === 'shout') {
      listener.state = 'hunt';
      listener.huntT = 12;
      listener.lastHeard.copy(player.pos);
      this.hint = 'You said your own name like you meant it. The house has it now.';
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
      this.inspect = { title: it.title, body: on ? 'Warmth holds a little of the room.' : 'The dark comes back in, like it was waiting.' };
      this.inspectT = 2.2;
      emitSound(it.pos, 2.5, 'click');
      return;
    }
    if (it.kind === 'drawer' || it.kind === 'cupboard') {
      if (it.anim) it.anim.want = it.anim.want > 0.5 ? 0 : 1;
      if (it.frag) this._learn(it.frag);
      this.inspect = { title: it.title, body: it.body || '' };
      this.inspectT = 6.2;
      emitSound(it.pos, 3.2, 'door');
      return;
    }
    if (it.frag) this._learn(it.frag);
    if (it.kind === 'key' && !this.hasDamper) {
      this.hasDamper = true;
      this.hint = 'Damper in the hand. Parlor grate. Whisper. Do not shout.';
    }
    if (it.anim && it.kind === 'lid') it.anim.want = it.anim.want > 0.5 ? 0 : 1;
    this.inspect = { title: it.title, body: it.body || '' };
    this.inspectT = 6.2;
    if (it.kind === 'grate' && this.fragments.maren && this.hasDamper) {
      this.hint = 'Whisper MAREN. Hold V. Do not shout.';
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
