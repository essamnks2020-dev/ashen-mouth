import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Voice } from './core/voice.js';
import { PostFX, pixelRatioFor } from './core/fx.js';
import { loadSettings, saveSettings, clamp01, damp } from './core/util.js';
import { World } from './world/world.js';
import { makeMaterials, makeSky, NIGHT } from './world/materials.js';
import { buildHouse } from './world/house.js';
import { Player } from './game/player.js';
import { Listener } from './game/creature.js';
import { Story } from './game/story.js';
import { Life } from './game/life.js';

const $ = (id) => document.getElementById(id);
const screens = ['boot', 'title', 'intro', 'pause', 'settings', 'win', 'lose'];

class Game {
  constructor() {
    this.settings = loadSettings();
    this.mode = 'boot';
    this.prev = 'title';
    this.clock = new THREE.Clock();
    this.sounds = [];
    this.lastSound = new THREE.Vector3();
    this.voiceEmit = 0;
    this.phrasesOn = false;
    this.selectedWord = 0;
  }

  setScreen(id) {
    for (const s of screens) $(s).classList.toggle('active', s === id);
    $('hud').classList.toggle('active', id === 'play');
    if (id === 'intro') $('hud').classList.remove('active');
  }

  async boot() {
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.72;
    this.renderer.shadowMap.enabled = this.settings.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(NIGHT, 1);
    this._resize();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1c2634, 0.0048);
    this.scene.background = new THREE.Color(0x0e1620);

    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 220);

    this.sky = makeSky();
    this.scene.add(this.sky);

    $('boot-fill').style.width = '30%';
    $('boot-status').textContent = 'laying floors…';
    await tick();

    this.mats = makeMaterials(this.settings.quality);
    this.world = new World();
    this.level = buildHouse(this.scene, this.world, this.mats, this.settings.quality);
    for (const it of this.level.interact) {
      if (it.door && !it.door.want) {
        /* closed */
      }
    }

    $('boot-fill').style.width = '65%';
    $('boot-status').textContent = 'the grate still glows…';
    await tick();

    this.player = new Player(this.camera, this.world);
    this.player.pos.copy(this.level.spawn);
    this.player.yaw = this.level.spawnYaw;
    this.player.attachLanternMesh(this.mats);
    this.scene.add(this.camera);

    this.listener = new Listener(this.scene, this.mats, this.world, this.level.patrol);
    this.story = new Story();
    this.life = new Life(this.scene, this.settings.quality);
    if (this.level.lampPos) this.life.lamp.copy(this.level.lampPos);

    this.fx = new PostFX(this.renderer, this.scene, this.camera);
    this.fx.setQuality(this.settings.quality);

    this.input = new Input();
    this.input.attach(canvas);
    this.input.sens = this.settings.sens;
    this.input.invertY = this.settings.invertY;

    this.audio = new AudioEngine();
    this.voice = new Voice();

    this._bindUI();
    this._syncSettings();

    $('boot-fill').style.width = '100%';
    $('boot-status').textContent = 'the house is waiting';
    await wait(280);
    this.mode = 'title';
    this.setScreen('title');
    requestAnimationFrame(() => this.loop());
    const qa = new URLSearchParams(location.search).get('qa');
    if (qa) this._qa(qa);
  }

  _qa(shot) {
    this.audio.init();
    this.audio.setMute(true);
    this._skipIntro();
    $('hud').classList.remove('active');
    const p = this.player;
    p.lanternOn = false;
    p.lantern.intensity = 0;
    p.fill.intensity = 0.12;
    if (shot === 'porch') {
      p.pos.set(0.05, 0.02, 7.15); p.yaw = 0; p.pitch = -0.12;
      if (this.level.frontDoor) this.level.frontDoor.want = 1;
    }
    else if (shot === 'outside') { p.pos.set(0.2, 0.02, 10.8); p.yaw = 0; p.pitch = 0.06; }
    else if (shot === 'foyer') { p.pos.set(-0.42, 0.02, 4.22); p.yaw = 0; p.pitch = -0.04; }
    else if (shot === 'stair') { p.pos.set(0.94, 0.02, 4.52); p.yaw = 0; p.pitch = 0.42; }
    else if (shot === 'stairwalk') {
      p.pos.set(0.94, 0.06, 4.40);
      p.yaw = 0;
      p.vel.set(0, 0, 0);
      for (let i = 0; i < 220; i++) {
        p.vel.x = 0;
        p.vel.z = -2.15;
        this.world.moveCapsule(p.pos, p.vel, p.radius, p.height, 1 / 60);
      }
      p.pitch = 0.12;
      document.title = `stair y=${p.pos.y.toFixed(2)} z=${p.pos.z.toFixed(2)} ramp=${this.world.onRamp ? 1 : 0}`;
    }
    else if (shot === 'up') { p.pos.set(-0.35, 2.82, 0.9); p.yaw = Math.PI; p.pitch = 0.15; }
    else if (shot === 'parlor') { p.pos.set(-2.4, 0.02, 2.75); p.yaw = Math.PI * 0.5; p.pitch = 0.05; }
    else if (shot === 'kitchen') { p.pos.set(3.2, 0.02, 3.2); p.yaw = -1.2; p.pitch = 0.08; }
    this.player.cam.position.set(p.pos.x, p.pos.y + p.eye, p.pos.z);
    this.player.cam.rotation.order = 'YXZ';
    this.player.cam.rotation.y = p.yaw;
    this.player.cam.rotation.x = p.pitch;
  }

  _bindUI() {
    document.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this._act(btn.dataset.act));
    });
    $('intro-skip').addEventListener('click', () => this._skipIntro());
    $('set-quality').addEventListener('change', (e) => {
      this.settings.quality = e.target.value;
      this._applyQuality();
      saveSettings(this.settings);
    });
    $('set-sens').addEventListener('input', (e) => {
      this.settings.sens = +e.target.value;
      this.input.sens = this.settings.sens;
      saveSettings(this.settings);
    });
    $('set-master').addEventListener('input', (e) => {
      this.settings.master = +e.target.value;
      this.audio.setVolume('master', this.settings.master);
      saveSettings(this.settings);
    });
    $('set-mute').addEventListener('change', (e) => {
      this.settings.mute = e.target.checked;
      this.audio.setMute(this.settings.mute);
      saveSettings(this.settings);
    });
    $('set-mic').addEventListener('change', (e) => {
      this.settings.mic = e.target.checked;
      this.voice.setEnabled(this.settings.mic);
      saveSettings(this.settings);
    });
    $('set-inverty').addEventListener('change', (e) => {
      this.settings.invertY = e.target.checked;
      this.input.invertY = this.settings.invertY;
      saveSettings(this.settings);
    });
    addEventListener('resize', () => this._resize());
  }

  _syncSettings() {
    $('set-quality').value = this.settings.quality;
    $('set-sens').value = this.settings.sens;
    $('set-master').value = this.settings.master;
    $('set-mute').checked = this.settings.mute;
    $('set-mic').checked = this.settings.mic;
    $('set-inverty').checked = this.settings.invertY;
  }

  _applyQuality() {
    const q = this.settings.quality;
    this.renderer.setPixelRatio(pixelRatioFor(q));
    this.renderer.shadowMap.enabled = q === 'high';
    this.fx.setQuality(q);
    this._resize();
  }

  _act(a) {
    this.audio.ui?.();
    if (a === 'play') this._start();
    if (a === 'settings') { this.prev = this.mode === 'pause' ? 'pause' : 'title'; this.setScreen('settings'); }
    if (a === 'back') this.setScreen(this.prev === 'pause' ? 'pause' : 'title');
    if (a === 'resume') this._resume();
    if (a === 'menu') { this.input.exitLock(); this.mode = 'title'; this.setScreen('title'); }
    if (a === 'again') location.reload();
  }

  async _start() {
    this.audio.init();
    this.audio.resume();
    this.audio.setVolume('master', this.settings.master);
    this.audio.setMute(this.settings.mute);
    this.mode = 'intro';
    this.setScreen('intro');
    this.story.introT = 0;
    this.story.introDone = false;
    if (this.settings.mic) {
      this.voice.init(this.audio).catch(() => { this.voice.fallback = true; this.voice.micDenied = true; });
    } else {
      this.voice.fallback = true;
      this.voice.enabled = false;
    }
  }

  _skipIntro() {
    this.story.skipIntro();
    this._enterPlay();
  }

  _enterPlay() {
    this.mode = 'play';
    this.setScreen('play');
    $('hud').classList.add('active');
    this.player.pos.copy(this.level.spawn);
    this.player.yaw = this.level.spawnYaw;
    this.player.pitch = -0.04;
    this.input.requestLock();
  }

  _resume() {
    this.mode = 'play';
    this.setScreen('play');
    $('hud').classList.add('active');
    this.input.requestLock();
  }

  emitSound(pos, power, kind) {
    const p = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z);
    this.sounds.push({ pos: p, power, kind, t: 0 });
    this.lastSound.copy(p);
    this.listener.hear(p, power, kind, this.voice.lastPhrase);
    if (kind === 'step') this.audio.foot?.(p.x, p.y, p.z, 'wood', power < 3);
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._frame(dt);
  };

  _frame(dt) {
    const t = performance.now() * 0.001;
    if (this.sky.material.uniforms) this.sky.material.uniforms.uTime.value = t;
    if (this.mats.curtainMat.userData.shader) this.mats.curtainMat.userData.shader.uniforms.uTime.value = t;

    for (const L of this.level.lights) {
      const on = L.on !== false;
      const flick = L.flicker ? Math.sin(t * (4 + (L.id || '').length)) * L.flicker * 0.5 + Math.sin(t * 11.3) * L.flicker * 0.25 : 0;
      L.light.intensity = on ? L.base + flick : 0.02;
    }
    for (const liv of this.level.living) liv.update(dt, t, this.player);

    if (this.mode === 'title' || this.mode === 'settings' || this.mode === 'boot') {
      this.camera.position.set(0.35 + Math.sin(t * 0.06) * 0.25, 1.62, 12.6);
      this.camera.lookAt(0.05, 2.15, 5.15);
      if (this.player) {
        this.player.lantern.visible = false;
        this.player.hand.visible = false;
      }
      this.fx.update(dt, this.camera);
      this.fx.render();
      this.input.endFrame();
      return;
    }

    if (this.mode === 'intro') {
      if (this.player) { this.player.lantern.visible = false; this.player.hand.visible = false; }
      const card = this.story.intro(dt, this.camera);
      if (this.level.frontDoor) this.level.frontDoor.want = this.story.introT > 14.5 ? 1 : 0;
      $('intro-card').textContent = card.card || '';
      $('intro-radio').textContent = card.line || '';
      if (this.input.pressed('Space') || this.input.pressed('Escape') || this.input.pressed('Enter')) this._skipIntro();
      if (this.story.introDone) this._enterPlay();
      this.fx.update(dt, this.camera);
      this.fx.render();
      this.input.endFrame();
      return;
    }

    if (this.mode === 'pause' || this.mode === 'settings') {
      this.fx.update(dt, this.camera);
      this.fx.render();
      this.input.endFrame();
      return;
    }

    if (this.mode !== 'play') {
      this.fx.update(dt, this.camera);
      this.fx.render();
      this.input.endFrame();
      return;
    }

    if (this.input.pressed('Escape')) {
      this.mode = 'pause';
      this.input.exitLock();
      this.setScreen('pause');
      $('hud').classList.remove('active');
      this.input.endFrame();
      return;
    }
    if (this.player) {
      this.player.lantern.visible = this.player.lanternOn;
      this.player.hand.visible = true;
    }
    if (!this.input.locked && !this.input.mobile && this.input.clicked) this.input.requestLock();

    if (this.input.pressed('KeyT')) this.phrasesOn = !this.phrasesOn;
    $('phrases').classList.toggle('on', this.phrasesOn);

    const hold = this.input.held('KeyN') ? 3 : this.input.held('KeyB') ? 2 : this.input.held('KeyV') ? 1 : 0;
    this.voice.setHold(hold);
    if (this.phrasesOn) {
      for (let i = 0; i < 9; i++) {
        if (this.input.pressed('Digit' + (i + 1)) && this.story.known[i]) {
          this.selectedWord = i;
          const level = hold === 3 ? 3 : hold === 2 ? 2 : 1;
          this.voice.speakFallback(this.story.known[i], level);
          this.audio.speakPuff(level > 2);
        }
      }
    }

    this.voice.update(dt);
    this.voiceEmit -= dt;
    if (this.voice.soundPower() > 0 && this.voiceEmit <= 0) {
      const kind = this.voice.mode === 'shout' ? 'shout' : 'voice';
      this.emitSound(this.player.pos, this.voice.soundPower(), kind);
      this.voiceEmit = this.voice.mode === 'whisper' ? 0.45 : 0.22;
      if (this.voice.mode !== 'whisper') this.audio.speakPuff(this.voice.mode === 'shout');
    }

    const emit = (pos, power, kind) => this.emitSound(pos, power, kind);
    this.player.update(dt, this.input, emit);

    if (this.input.pressed('KeyE')) this.story.use(this.player, this.audio, emit, this.listener, this.level);

    this.story.update(dt, this.player, this.level, this.listener, this.voice, this.audio, emit, this.fx);
    this.listener.update(dt, this.player, this.audio, this.fx, emit);
    this.life.update(dt, t, this.player, this.story.zone);

    const dL = this.listener.root.position.distanceTo(this.player.pos);
    this.audio.setListener(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z,
      -Math.sin(this.player.yaw), -Math.cos(this.player.yaw));
    this.audio.setTension(clamp01(this.listener.aware * 0.5 + (this.listener.state === 'hunt' ? 0.5 : 0) + (dL < 10 ? (10 - dL) / 20 : 0)));
    if (dL < 8 && this.listener.woke) this.audio.heartbeat(dL < 3.5);

    this.camera.fov = damp(this.camera.fov, this.listener.state === 'attack' ? 74 : 68, 4, dt);
    this.camera.updateProjectionMatrix();

    if (this.story.end === 'bind' && this.story.endT > 3.2) {
      this.mode = 'win';
      this.input.exitLock();
      this.setScreen('win');
      $('hud').classList.remove('active');
    }
    if (this.story.end === 'taken' && this.story.endT > 2.4) {
      this.mode = 'lose';
      this.input.exitLock();
      this.setScreen('lose');
      $('hud').classList.remove('active');
    }

    this._hud();
    this.fx.update(dt, this.camera);
    this.fx.render();
    this.input.endFrame();
  }

  _hud() {
    const bits = [
      this.story.fragments.ma ? 'MA' : '—',
      this.story.fragments.ren ? 'REN' : '—',
      this.story.fragments.maren ? 'MAREN' : '—',
    ];
    $('hud-frag').textContent = bits.join('   ');
    $('hud-fork').textContent = this.story.hasDamper ? 'DAMPER' : '';
    $('hint').textContent = this.story.hint;
    const n = this.story.near;
    const prompt = $('prompt');
    if (n) {
      prompt.textContent = 'E  ·  ' + n.title;
      prompt.classList.add('on');
    } else prompt.classList.remove('on');

    const ins = $('inspect');
    if (this.story.inspect && this.story.inspectT > 0) {
      $('ins-title').textContent = this.story.inspect.title;
      $('ins-body').textContent = this.story.inspect.body;
      ins.classList.add('on');
    } else ins.classList.remove('on');

    const noise = Math.max(this.voice.volume, this.player.moved / 6);
    $('meter-fill').style.width = (clamp01(noise) * 100) + '%';
    $('listen-pill').classList.toggle('on', this.listener.state === 'listen' || this.listener.state === 'attack');
    const mic = $('mic-pill');
    mic.textContent = this.voice.micDenied || this.voice.fallback ? 'VOICE KEYS  V B N' : this.voice.listening ? 'MIC LIVE' : 'MIC';
    mic.classList.toggle('live', this.voice.listening && !this.voice.fallback);
    mic.classList.toggle('off', this.voice.fallback || this.voice.micDenied);

    const list = $('phrase-list');
    list.innerHTML = this.story.known.length
      ? this.story.known.map((w, i) => `<div class="ph-item"><em>${i + 1}</em>${w}</div>`).join('')
      : '<div class="ph-item">nothing yet — read the house</div>';
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    const pr = pixelRatioFor(this.settings.quality);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.fx?.resize();
  }
}

function tick() { return new Promise((r) => setTimeout(r, 40)); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

const game = new Game();
game.boot().then(() => {
  // Automation / recording surface — no secrets, just drives the house tour.
  window.__AM = {
    ready: true,
    mode: () => game.mode,
    start() { return game._act('play'); },
    skipIntro() { game._skipIntro(); },
    state() {
      return {
        mode: game.mode,
        zone: game.story?.zone,
        pos: game.player ? { x: game.player.pos.x, y: game.player.pos.y, z: game.player.pos.z } : null,
        yaw: game.player?.yaw,
        frags: { ...game.story?.fragments },
        damper: !!game.story?.hasDamper,
        known: [...(game.story?.known || [])],
        end: game.story?.end,
        near: game.story?.near?.title || null,
      };
    },
    go(x, y, z, yaw = 0, pitch = 0) {
      if (!game.player) return;
      game.player.pos.set(x, y, z);
      game.player.yaw = yaw;
      game.player.pitch = pitch;
      game.player.vel.set(0, 0, 0);
      game.player.cam.position.set(x, y + game.player.eye, z);
      game.player.cam.rotation.order = 'YXZ';
      game.player.cam.rotation.y = yaw;
      game.player.cam.rotation.x = pitch;
    },
    openDoor(id, open = true) {
      const d = game.level?.doors?.find((x) => x.id === id);
      if (d) d.want = open ? 1 : 0;
    },
    useNear() {
      game.story?.use(game.player, game.audio, (p, pow, k) => game.emitSound(p, pow, k), game.listener, game.level);
    },
    useId(id) {
      const it = game.level?.interact?.find((x) => x.id === id);
      if (!it) return false;
      game.story.near = it;
      game.story.use(game.player, game.audio, (p, pow, k) => game.emitSound(p, pow, k), game.listener, game.level);
      return true;
    },
    learnAll() {
      game.story._learn('ma');
      game.story._learn('ren');
      game.story._learn('maren');
    },
    takeDamper() {
      game.story.hasDamper = true;
      game.story.hint = 'Damper in hand. Whisper MAREN at the grate.';
    },
    whisperMaren() {
      game.phrasesOn = true;
      if (!game.story.known.includes('MAREN')) game.story.known.push('MAREN');
      game.voice.speakFallback('MAREN', 1);
      game.voice.flags.bound = true;
      game.voice.flags.frag = 'maren';
    },
    shout() { game.voice.speakFallback('help', 3); },
    lantern(on) { if (game.player) game.player.lanternOn = !!on; },
    unlockInput() {
      game.input.locked = true; // pretend locked so movement accepts look without pointer lock
    },
  };
  const tour = new URLSearchParams(location.search).get('tour');
  if (tour === '1') {
    // Auto cinematic tour used by the playthrough recorder.
    setTimeout(() => runTour(window.__AM), 600);
  }
}).catch((err) => {
  console.error(err);
  const s = $('boot-status');
  if (s) s.textContent = 'the house failed — ' + (err && err.message ? err.message : err);
});
addEventListener('error', (e) => {
  const s = $('boot-status');
  if (s && $('boot')?.classList.contains('active')) s.textContent = 'the house failed — ' + e.message;
});

async function runTour(am) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const hold = async (ms, fn) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { fn(); await sleep(32); }
  };
  try {
    am.start();
    await sleep(2200);
    // Let intro play a bit from outside
    await sleep(5500);
    am.skipIntro();
    am.unlockInput();
    am.lantern(true);
    am.openDoor('front', true);
    await sleep(400);

    const beats = [
      [0.05, 0.02, 10.5, 0, 0.05, 1800],
      [0.05, 0.02, 7.2, 0, -0.08, 1600],
      [-0.35, 0.02, 4.4, 0, -0.02, 1400],
      [-0.2, 0.02, 3.4, Math.PI, 0.05, 1200],
      [-3.2, 0.02, 2.9, Math.PI * 0.5, 0.05, 1600],
      [-3.5, 0.02, 2.5, Math.PI * 0.55, 0.1, 1400],
      [3.4, 0.02, 3.1, -1.1, 0.08, 1600],
      [-3.4, 0.02, -1.7, 0, 0.05, 1400],
      [0.94, 0.1, 4.2, 0, 0.35, 1200],
      [0.94, 1.4, 2.4, 0, 0.2, 1400],
      [-0.3, 2.82, 2.2, Math.PI, 0.1, 1400],
      [-3.5, 2.82, 2.5, Math.PI * 0.5, 0.05, 1400],
      [3.6, 2.82, 2.6, -1.0, 0.05, 1400],
      [2.2, 0.02, -2.4, 0, 0.25, 1200],
      [2.2, -2.4, -1.0, Math.PI, 0.1, 1400],
      [-2.1, -2.7, 0.2, Math.PI * 0.5, 0.15, 1600],
      [-3.2, 0.02, 2.85, Math.PI * 0.5, 0.08, 1600],
    ];
    for (const [x, y, z, yaw, pitch, wait] of beats) {
      am.go(x, y, z, yaw, pitch);
      await sleep(wait);
    }
    // Interactables + voice + win
    am.go(-3.4, 0.02, 2.75, Math.PI * 0.5, 0.1);
    am.useId('photo');
    await sleep(1200);
    am.go(3.55, 0.02, 3.15, 0, 0.2);
    am.useId('letter');
    await sleep(1000);
    am.go(3.9, 2.82, 3.0, -0.4, 0.1);
    am.openDoor('child', true);
    am.useId('drawing');
    await sleep(1000);
    am.go(-2.15, -2.6, 0.2, 0, 0.2);
    am.useId('damper');
    await sleep(1000);
    am.learnAll();
    am.takeDamper();
    am.go(-3.1, 0.02, 2.85, Math.PI * 0.55, 0.15);
    await sleep(600);
    am.whisperMaren();
    await hold(2200, () => am.whisperMaren());
    await sleep(3500);
  } catch (e) {
    console.error('tour failed', e);
  }
}