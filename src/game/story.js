import * as THREE from 'three';
import { lerp, clamp01, damp } from '../core/util.js';
import { setDoorOpen } from '../world/level.js';

export const WORDS = {
  orth: { glyph: 'ORTH', hint: 'a first syllable, painted into a mouth' },
  ael: { glyph: 'AEL', hint: 'a last syllable, dittoed into a ledger' },
  orthael: { glyph: 'ORTHAEL', hint: 'one breath. the stilling.' },
};

const INTRO = [
  { t: 0.0, pos: [2.2, 1.35, 51.0], look: [0, 9, 8], card: '', radio: '— salt static —' },
  { t: 4.2, pos: [1.4, 2.4, 47.5], look: [0, 12, 4], card: 'RELIEF-7  ·  dusk inbound', radio: 'the boats were supposed to be spared' },
  { t: 9.0, pos: [-3.2, 4.8, 40.0], look: [2, 14, 2], card: '', radio: 'last voice on the coil:' },
  { t: 14.0, pos: [0.2, 3.1, 41.2], look: [0, 8, 18], card: 'a child, repeating a name', radio: 'Essam. Essam. Essam.' },
  { t: 20.0, pos: [0.0, 2.2, 39.4], look: [0, 6, 22], card: 'ASHEN MOUTH', radio: 'it learned how to answer' },
  { t: 26.5, pos: [0.0, 1.7, 38.6], look: [0, 1.6, 22], card: '', radio: 'silence is stealth' },
  { t: 32.0, pos: [0.0, 2.05, 38.5], look: [0, 1.8, 22], card: '', radio: '' },
];

export class Story {
  constructor() {
    this.fragments = { orth: false, ael: false, orthael: false };
    this.hasFork = false;
    this.known = [];
    this.introT = 0;
    this.introDone = false;
    this.binding = 0;
    this.end = null; // 'bind' | 'taken'
    this.endT = 0;
    this.woke = false;
    this.hint = 'The dock still smells of diesel and incense.';
    this.inspect = null;
    this.inspectT = 0;
    this.zone = 'dock';
    this.near = null;
  }

  skipIntro() { this.introT = 33; this.introDone = true; }

  intro(dt, cam) {
    this.introT += dt;
    const t = this.introT;
    if (t >= 32.4) { this.introDone = true; return { card: '', radio: '', skippable: true }; }
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
    const lx = lerp(a.look[0], b.look[0], s);
    const ly = lerp(a.look[1], b.look[1], s);
    const lz = lerp(a.look[2], b.look[2], s);
    cam.lookAt(lx, ly, lz);
    const card = s < 0.85 ? a.card : b.card;
    const radio = s < 0.5 ? a.radio : b.radio;
    return { card, radio, skippable: true, t };
  }

  zoneOf(p, zones) {
    for (const [k, z] of Object.entries(zones)) {
      if (k.startsWith('_')) continue;
      if (p.x >= z.minx && p.x <= z.maxx && p.z >= z.minz && p.z <= z.maxz) return k;
    }
    return this.zone;
  }

  update(dt, player, level, saint, voice, audio, emitSound, fx) {
    this.zone = this.zoneOf(player.pos, level.zones);
    if (!this.woke && (this.zone === 'chapel' || this.zone === 'archive')) {
      this.woke = true;
      saint.wake();
      this.hint = 'Something in the rock leaned toward you.';
    }

    this.near = this._nearest(player, level.interact);
    this.inspectT = Math.max(0, this.inspectT - dt);

    if (voice.flags.self && voice.mode === 'shout') {
      saint.aware = 1;
      saint.lastHeard.copy(player.pos);
      if (saint.state !== 'dormant') saint._enter('hunt');
      fx.stat = Math.max(fx.stat, 0.75);
      this.hint = 'You said your name into a thing that collects names.';
    }
    if (voice.flags.bound && voice.mode !== 'shout') {
      if (this.zone === 'chamber' && this.hasFork) {
        this.binding = Math.min(1, this.binding + dt * 0.38);
        saint.pin(1.2);
        if (this.binding >= 1 && !this.end) this._win(saint, audio, fx);
      } else if (saint.visible) {
        saint.pin(4.2);
        audio.pin();
        this.hint = 'The name holds it — briefly. It hates being still.';
      }
    } else if (this.zone !== 'chamber') {
      this.binding = Math.max(0, this.binding - dt * 0.4);
    } else if (!voice.flags.bound) {
      this.binding = Math.max(0, this.binding - dt * 0.15);
    }

    if (voice.flags.frag === 'orth' && !this.fragments.orth) { /* spoken fragment attracts */ }
    if (voice.mode === 'shout') fx.stat = Math.max(fx.stat, 0.35);

    if (saint.state === 'taking' && saint.stateT > 2.6 && !this.end) this._lose(fx);
    if (this.end) this.endT += dt;

    // inhale pull
    if (saint.pull > 0.05 && saint.state !== 'bound') {
      const dir = saint.root.position.clone().sub(player.pos);
      dir.y = 0;
      const d = dir.length() || 1;
      const f = saint.pull * 6.5 * (1 / d);
      player.vel.x += dir.x / d * f * dt * 18;
      player.vel.z += dir.z / d * f * dt * 18;
    }

    if (this.zone === 'chapel' && !this.fragments.orth)
      this.hint = this.hint || 'A mural at the far end still has a word in its mouth.';
  }

  use(player, audio, emitSound, saint) {
    const it = this.near;
    if (!it) return;
    if (it.kind === 'door') {
      const open = !it.door.open;
      setDoorOpen(it.door, open);
      it.door.t = open ? 1 : 0;
      it.door.group.rotation.y = it.door.rotY + (open ? 1.25 : 0);
      audio.door(it.pos.x, it.pos.y, it.pos.z);
      emitSound(it.pos, 11, 'door');
      return;
    }
    if (it.kind === 'bell') {
      audio.bell(it.pos.x, it.pos.y, it.pos.z);
      emitSound(it.pos, 32, 'bell');
      this.inspect = { title: it.title, body: it.body };
      this.inspectT = 5;
      this.hint = 'The whole stack heard that.';
      return;
    }
    if (it.kind === 'take') {
      this.hasFork = true;
      it.taken = true;
      it.r = 0;
      audio.pin();
      this.inspect = { title: it.title, body: it.body };
      this.inspectT = 6;
      this.hint = 'The fork is warm. It wants the bound name whispered into the Mouth.';
      return;
    }
    if (it.kind === 'bind') {
      if (!this.fragments.orthael && !(this.fragments.orth && this.fragments.ael)) {
        this.inspect = { title: it.title, body: 'You do not yet have both halves of the stilling.' };
      } else if (!this.hasFork) {
        this.inspect = { title: it.title, body: 'The Mouth will not close for a bare voice. The stilling fork is missing.' };
      } else {
        this.inspect = { title: it.title, body: 'Whisper ORTHAEL. One breath. Do not shout your name.' };
      }
      this.inspectT = 7;
      audio.inspect();
      return;
    }
    // inspect
    audio.inspect();
    if (it.sound === 'radio') audio.radioBurst(it.pos.x, it.pos.y, it.pos.z);
    if (it.sound === 'vinyl') audio.vinyl(it.pos.x, it.pos.y, it.pos.z);
    emitSound(it.pos, it.loud ? 20 : 2.2, 'inspect');
    this.inspect = { title: it.title, body: it.body };
    this.inspectT = 8;
    if (it.fragment && !this.fragments[it.fragment]) {
      this.fragments[it.fragment] = true;
      const g = WORDS[it.fragment]?.glyph;
      if (g && !this.known.includes(g)) this.known.push(g);
      this.hint = 'A true sound, now yours: ' + (g || it.fragment);
    }
    if (this.fragments.orth && this.fragments.ael && !this.known.includes('ORTHAEL')) {
      this.known.push('ORTHAEL');
      this.fragments.orthael = true;
    }
    if (it.word === 'ORTHAEL') {
      this.fragments.orthael = true;
      if (!this.known.includes('ORTHAEL')) this.known.push('ORTHAEL');
    }
  }

  _nearest(player, list) {
    let best = null, bd = 2.2;
    for (const it of list) {
      if (it.taken) continue;
      const d = player.pos.distanceTo(it.pos);
      if (d < Math.max(it.r, 1.2) && d < bd) { bd = d; best = it; }
    }
    return best;
  }

  _win(saint, audio, fx) {
    this.end = 'bind';
    this.endT = 0;
    saint.bind();
    audio.bindChime();
    fx.flash = 0.6;
    this.hint = 'The mouths close. Somewhere past the still cloud, a hull is not breaking.';
  }
  _lose(fx) {
    this.end = 'taken';
    this.endT = 0;
    fx.taken = 1;
  }

  progress() {
    let n = 0;
    if (this.fragments.orth) n++;
    if (this.fragments.ael) n++;
    if (this.fragments.orthael || (this.fragments.orth && this.fragments.ael)) n++;
    if (this.hasFork) n++;
    return n; // 0-4
  }
}
