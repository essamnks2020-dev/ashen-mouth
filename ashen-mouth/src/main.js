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
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: this.settings.quality !== 'low', powerPreference: 'high-performance',
      stencil: false, depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.58;
    this.renderer.shadowMap.enabled = this.settings.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(NIGHT, 1);
    this._resize();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x1c2634, 0.0048);
    this.scene.background = new THREE.Color(0x0e1620);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov || 64, innerWidth / innerHeight, 0.1, 160);
    this._fovShown = this.camera.fov;

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
    this.player.fovBase = this.settings.fov || 64;
    this.player.bobOn = this.settings.bob !== false;
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
      if ($('set-sens-val')) $('set-sens-val').textContent = Number(this.settings.sens).toFixed(2);
      saveSettings(this.settings);
    });
    $('set-master').addEventListener('input', (e) => {
      this.settings.master = +e.target.value;
      this.audio.setVolume('master', this.settings.master);
      if ($('set-master-val')) $('set-master-val').textContent = Math.round(this.settings.master * 100) + '%';
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
    $('set-fov')?.addEventListener('input', (e) => {
      this.settings.fov = +e.target.value;
      this.camera.fov = this.settings.fov;
      this.player.fovBase = this.settings.fov;
      this._fovShown = -1;
      $('set-fov-val').textContent = String(this.settings.fov);
      saveSettings(this.settings);
    });
    $('set-bob')?.addEventListener('change', (e) => {
      this.settings.bob = e.target.checked;
      if (this.player) this.player.bobOn = this.settings.bob;
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
    if ($('set-fov')) {
      $('set-fov').value = this.settings.fov || 64;
      $('set-fov-val').textContent = String(this.settings.fov || 64);
    }
    if ($('set-sens-val')) $('set-sens-val').textContent = Number(this.settings.sens).toFixed(2);
    if ($('set-master-val')) $('set-master-val').textContent = Math.round(this.settings.master * 100) + '%';
    if ($('set-bob')) $('set-bob').checked = this.settings.bob !== false;
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
    this.player._yawS = this.player.yaw;
    this.player._pitchS = this.player.pitch;
    this.player.bobOn = this.settings.bob !== false;
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
      if (!L.light.visible) continue;
      const on = L.on !== false;
      const flick = L.flicker ? Math.sin(t * (4 + (L.id || '').length)) * L.flicker * 0.5 + Math.sin(t * 11.3) * L.flicker * 0.25 : 0;
      L.light.intensity = on ? L.base + flick : 0.02;
    }
    for (const liv of this.level.living) liv.update(dt, t, this.player);
    this._cullLights();

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
      if (this.level.frontDoor) this.level.frontDoor.want = this.story.introT > 21.5 ? 1 : 0;
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

    const wantFov = this.listener.state === 'attack' ? Math.min(74, this.player.fovBase + 8) : this.player.fovBase;
    this.camera.fov = damp(this.camera.fov, wantFov, 4, dt);
    if (Math.abs(this.camera.fov - this._fovShown) > 0.08) {
      this.camera.updateProjectionMatrix();
      this._fovShown = this.camera.fov;
    }
    if (this.mode === 'play') this._cullLights();

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
    $('hud-fork').textContent = this.story.hasDamper ? 'DAMPER IN HAND' : '';
    $('hint').textContent = this.story.hint;
    const n = this.story.near;
    const prompt = $('prompt');
    if (n) {
      prompt.textContent = n.title;
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
      : '<div class="ph-item">Nothing yet. Read the rooms. The house wrote it down.</div>';
  }

  _cullLights() {
    const p = this.player ? this.player.pos : this.camera.position;
    const budget = this.settings.quality === 'high' ? 9 : this.settings.quality === 'medium' ? 6 : 4;
    const ranked = this.level.lights.map((L) => {
      const lp = L.light.position;
      const dx = lp.x - p.x, dy = lp.y - p.y, dz = lp.z - p.z;
      const keep = L.id === 'fire' || L.id === 'furnace';
      return { L, d2: dx * dx + dy * dy + dz * dz, keep };
    });
    ranked.sort((a, b) => a.d2 - b.d2);
    let used = 0;
    for (let i = 0; i < ranked.length; i++) {
      const row = ranked[i];
      const near = used < budget && row.d2 < 170;
      row.L.light.visible = row.keep || near;
      if (near) used++;
    }
    if (this.player && this.player.lantern) this.player.lantern.visible = this.mode === 'play' && this.player.lanternOn && this.player.lanternH > 0.1;
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
        pitch: game.player?.pitch,
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
      game.player._yawS = yaw;
      game.player._pitchS = pitch;
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
  const ease = (t) => t * t * (3 - 2 * t);
  const glide = async (x, y, z, yaw, pitch, ms) => {
    const st = am.state();
    const p0 = st.pos || { x: 0, y: 0, z: 10 };
    const y0 = st.yaw || 0;
    const p1 = st.pitch || 0;
    const t0 = performance.now();
    while (true) {
      const u = Math.min(1, (performance.now() - t0) / ms);
      const s = ease(u);
      am.go(
        p0.x + (x - p0.x) * s,
        p0.y + (y - p0.y) * s,
        p0.z + (z - p0.z) * s,
        y0 + (yaw - y0) * s,
        p1 + (pitch - p1) * s,
      );
      if (u >= 1) break;
      await sleep(24);
    }
  };
  try {
    am.start();
    // Full slow intro — do not skip. Let the house introduce itself.
    await sleep(49000);
    am.unlockInput();
    am.lantern(true);
    am.openDoor('front', true);
    await sleep(800);

    await glide(0.05, 0.02, 11.2, 0, 0.08, 2800);
    await sleep(900);
    await glide(0.05, 0.02, 8.4, 0, 0.04, 2600);
    await sleep(700);
    await glide(0.05, 0.02, 6.9, 0, -0.06, 2200);
    am.useId('number');
    await sleep(1800);
    await glide(-0.2, 0.02, 5.4, 0, -0.02, 2200);
    await sleep(600);
    await glide(-0.42, 0.02, 4.22, 0.15, 0.02, 2000);
    am.useId('clock');
    await sleep(2200);
    await glide(-0.42, 0.02, 4.6, 0.4, 0.08, 1400);
    am.useId('coat');
    await sleep(2000);
    am.openDoor('parlor', true);
    await glide(-2.1, 0.02, 3.1, Math.PI * 0.52, 0.04, 2800);
    await sleep(700);
    await glide(-3.15, 0.02, 2.85, Math.PI * 0.55, 0.12, 2200);
    am.useId('photo');
    await sleep(2600);
    await glide(-3.3, 0.02, 2.5, 0.2, 0.1, 1800);
    am.useId('radio');
    await sleep(1800);
    await glide(-3.2, 0.02, 2.9, Math.PI * 0.5, 0.18, 1400);
    am.useId('grate');
    await sleep(2000);
    am.openDoor('kitchen', true);
    await glide(3.4, 0.02, 3.15, -1.05, 0.08, 3200);
    await sleep(600);
    am.useId('letter');
    await sleep(2200);
    await glide(4.7, 0.02, 2.6, -1.4, 0.15, 1600);
    am.useId('Kitchen drawer');
    await sleep(1800);
    am.openDoor('dining', true);
    await glide(-3.5, 0.02, -1.75, 0, 0.08, 2800);
    am.useId('table');
    await sleep(1800);
    await glide(0.94, 0.08, 4.35, 0, 0.38, 2400);
    await sleep(400);
    await glide(0.94, 1.35, 2.6, 0, 0.18, 2800);
    await sleep(500);
    await glide(-0.3, 2.82, 2.2, Math.PI, 0.08, 2400);
    am.useId('landing');
    await sleep(1600);
    am.openDoor('master', true);
    await glide(-3.5, 2.82, 2.5, Math.PI * 0.5, 0.05, 2400);
    am.useId('wardrobe');
    await sleep(1800);
    am.openDoor('child', true);
    await glide(3.6, 2.82, 2.6, -1.0, 0.05, 2600);
    am.useId('drawing');
    await sleep(2400);
    await glide(2.2, 0.08, -2.5, 0.1, 0.28, 2800);
    await sleep(400);
    await glide(2.2, -2.4, -1.0, Math.PI, 0.08, 2600);
    await sleep(500);
    await glide(-2.15, -2.6, 0.2, Math.PI * 0.15, 0.18, 2400);
    am.useId('damper');
    await sleep(2000);
    am.learnAll();
    am.takeDamper();
    await glide(-3.15, 0.02, 2.85, Math.PI * 0.55, 0.12, 3200);
    await sleep(900);
    am.whisperMaren();
    await hold(2800, () => am.whisperMaren());
    await sleep(4200);
  } catch (e) {
    console.error('tour failed', e);
  }
}
