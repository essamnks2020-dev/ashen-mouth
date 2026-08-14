import * as THREE from 'three';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { Voice } from './core/voice.js';
import { PostFX, pixelRatioFor } from './core/fx.js';
import { loadSettings, saveSettings, clamp01, damp } from './core/util.js';
import { World } from './world/world.js';
import { makeSky, makeSea, makeMaterials, FogColor } from './world/shaders.js';
import { buildLevel, setDoorOpen } from './world/level.js';
import { Player } from './game/player.js';
import { Saint } from './game/saint.js';
import { Story } from './game/story.js';
import { Motes, Vortex } from './game/particles.js';

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
    this.acc = 0;
  }

  setScreen(id) {
    for (const s of screens) $(s).classList.toggle('active', s === id);
    $('hud').classList.toggle('active', id === 'play' || this.mode === 'play' && id === 'intro');
    if (id === 'intro') $('hud').classList.remove('active');
  }

  async boot() {
    const canvas = $('gl');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.settings.quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._resize();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FogColor, 0.011);
    this.scene.background = new THREE.Color(FogColor);

    this.camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.08, 420);

    this.sky = makeSky();
    this.scene.add(this.sky);
    this.sea = makeSea();
    this.scene.add(this.sea);

    const hemi = new THREE.HemisphereLight(0x7a6450, 0x0a0806, 0.72);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xc9a56a, 0.85);
    this.sun.position.set(18, 22, 30);
    this.sun.castShadow = this.settings.quality === 'high';
    if (this.sun.castShadow) {
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.camera.near = 2;
      this.sun.shadow.camera.far = 80;
      this.sun.shadow.camera.left = this.sun.shadow.camera.bottom = -30;
      this.sun.shadow.camera.right = this.sun.shadow.camera.top = 30;
    }
    this.scene.add(this.sun);

    this.chapelLight = new THREE.PointLight(0xffb45a, 0.55, 14, 1.8);
    this.chapelLight.position.set(0, 9.4, 7);
    this.scene.add(this.chapelLight);

    this.dockLight = new THREE.PointLight(0xffc078, 0.7, 10, 1.7);
    this.dockLight.position.set(0, 3.2, 36);
    this.scene.add(this.dockLight);

    $('boot-fill').style.width = '35%';
    $('boot-status').textContent = 'binding brass…';
    await tick();

    this.mats = makeMaterials();
    this.world = new World();
    this.level = buildLevel(this.scene, this.world, this.mats, this.settings.quality);
    for (const it of this.level.interact) {
      if (it.startOpen && it.door) {
        setDoorOpen(it.door, true);
        it.door.group.rotation.y = it.door.rotY + 1.25;
      }
    }

    $('boot-fill').style.width = '70%';
    $('boot-status').textContent = 'the saint leans in…';
    await tick();

    this.player = new Player(this.camera, this.world);
    this.player.pos.copy(this.level.spawn);
    this.player.attachLanternMesh(this.mats);
    this.scene.add(this.camera);

    this.saint = new Saint(this.scene, this.mats, this.world, this.level.patrol);
    this.story = new Story();
    this.motes = this.settings.quality === 'low' ? null : new Motes(this.scene, this.settings.quality === 'high' ? 90 : 40);
    this.vortex = new Vortex(this.scene);

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
    $('boot-status').textContent = 'coil open';
    await wait(280);
    this.mode = 'title';
    this.setScreen('title');
    requestAnimationFrame(() => this.loop());
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
    this.sun.castShadow = q === 'high';
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
    this.player.yaw = Math.PI;
    this.player.pitch = -0.08;
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
    this.saint.hear(p, power, kind, this.voice.lastPhrase);
  }

  loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._frame(dt);
  };

  _frame(dt) {
    const t = performance.now() * 0.001;
    this.sky.material.uniforms.uTime.value = t;
    this.sea.material.uniforms.uTime.value = t;
    this.sea.material.uniforms.uCam.value.copy(this.camera.position);

    if (this.mode === 'title' || this.mode === 'settings' || this.mode === 'boot') {
      this.camera.position.set(-8 + Math.sin(t * 0.07) * 2, 7.5, 32);
      this.camera.lookAt(0, 8, 8);
      if (this.player) {
        this.player.lantern.visible = false;
        this.player.hand.visible = false;
      }
      if (this.motes) this.motes.pts.visible = false;
      this.fx.update(dt, this.camera);
      this.fx.render();
      this.input.endFrame();
      return;
    }

    if (this.mode === 'intro') {
      if (this.player) { this.player.lantern.visible = false; this.player.hand.visible = false; }
      if (this.motes) this.motes.pts.visible = false;
      const card = this.story.intro(dt, this.camera);
      $('intro-card').textContent = card.card || '';
      $('intro-radio').textContent = card.radio || '';
      if (this.input.pressed('Space') || this.input.pressed('Escape') || this.input.pressed('Enter')) this._skipIntro();
      if (this.story.introDone) this._enterPlay();
      if (this.story.introT > 13 && this.story.introT < 14.2) this.audio.radioBurst?.(0, 4, 33);
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
    if (this.player) { this.player.lantern.visible = this.player.lanternOn; this.player.hand.visible = true; }
    if (this.motes) this.motes.pts.visible = true;
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
      this.emitSound(this.player.pos, this.voice.soundPower(), 'voice');
      this.voiceEmit = this.voice.mode === 'whisper' ? 0.45 : 0.22;
      if (this.voice.mode !== 'whisper') this.audio.speakPuff(this.voice.mode === 'shout');
    }

    const emit = (pos, power, kind) => this.emitSound(pos, power, kind);
    this.player.update(dt, this.input, emit);
    if (this.player.grounded && this.player.moved > 0.4) {
      /* footsteps already emit inside player */
    }

    if (this.input.pressed('KeyE')) this.story.use(this.player, this.audio, emit, this.saint);

    this.story.update(dt, this.player, this.level, this.saint, this.voice, this.audio, emit, this.fx);
    this.saint.update(dt, this.player, this.audio, this.fx, emit);

    const dSaint = this.saint.root.position.distanceTo(this.player.pos);
    this.audio.setListener(this.player.pos.x, this.player.pos.y + 1.4, this.player.pos.z,
      -Math.sin(this.player.yaw), -Math.cos(this.player.yaw));
    this.audio.setTension(clamp01(this.saint.aware * 0.5 + (this.saint.state === 'hunt' ? 0.5 : 0) + (dSaint < 10 ? (10 - dSaint) / 20 : 0)));
    if (dSaint < 9 && this.saint.visible) this.audio.heartbeat(dSaint < 4);

    this.chapelLight.intensity = 0.45 + Math.sin(t * 2.1) * 0.08;
    this.mats.candle.emissiveIntensity = 1.8 + Math.sin(t * 7.5) * 0.5 + Math.sin(t * 13.0) * 0.2;
    this.mats.glass.emissiveIntensity = 1.2 + Math.sin(t * 3.2) * 0.25;

    if (this.motes) this.motes.update(dt, this.voice.mode !== 'silent' ? this.player.pos : this.lastSound);
    this.vortex.update(dt, this.saint);

    this.camera.fov = damp(this.camera.fov, this.saint.pull > 0.2 ? 78 : 68, 4, dt);
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
      this.story.fragments.orth ? 'ORTH' : '—',
      this.story.fragments.ael ? 'AEL' : '—',
      this.story.fragments.orthael || (this.story.fragments.orth && this.story.fragments.ael) ? 'ORTHAEL' : '—',
    ];
    $('hud-frag').textContent = bits.join('   ');
    $('hud-fork').textContent = this.story.hasFork ? 'STILLING FORK' : '';
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
    $('listen-pill').classList.toggle('on', this.saint.state === 'listen' || this.saint.state === 'inhale');
    const mic = $('mic-pill');
    mic.textContent = this.voice.micDenied || this.voice.fallback ? 'VOICE KEYS  V B N' : this.voice.listening ? 'MIC LIVE' : 'MIC';
    mic.classList.toggle('live', this.voice.listening && !this.voice.fallback);
    mic.classList.toggle('off', this.voice.fallback || this.voice.micDenied);

    const list = $('phrase-list');
    list.innerHTML = this.story.known.length
      ? this.story.known.map((w, i) => `<div class="ph-item"><em>${i + 1}</em>${w}</div>`).join('')
      : '<div class="ph-item">nothing yet — inspect the stack</div>';
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
game.boot().catch((err) => {
  console.error(err);
  const s = $('boot-status');
  if (s) s.textContent = 'the coil failed — ' + (err && err.message ? err.message : err);
});
addEventListener('error', (e) => {
  const s = $('boot-status');
  if (s && $('boot')?.classList.contains('active')) s.textContent = 'the coil failed — ' + e.message;
});
