import { clamp01, lerp } from './util.js';

const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;

const NAME_SELF = /\b(essam|nasser|mom|mother|help|hello)\b/;
const NAME_BOUND = /\b(maren|ma ren)\b/;
const NAME_FRAG = /\b(maren|ma|ren)\b/;
const STILL = /\b(hush|be quiet|quiet|close the flue|still)\b/;

export class Voice {
  constructor() {
    this.enabled = true;
    this.supported = !!Rec;
    this.micDenied = false;
    this.listening = false;
    this.volume = 0;
    this.peak = 0;
    this.speaking = false;
    this.mode = 'silent'; // silent | whisper | talk | shout
    this.transcript = '';
    this.lastPhrase = '';
    this.lastAt = 0;
    this.flags = { self: false, bound: false, frag: '', still: false };
    this._rms = 0;
    this._analyser = null;
    this._rec = null;
    this.fallback = false;
    this.holdTalk = 0; // 0 silent, 1 whisper, 2 talk, 3 shout (fallback)
  }

  async init(audio) {
    this.audio = audio;
    if (!this.enabled) { this.fallback = true; return; }
    try {
      const micPromise = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('mic-timeout')), 4000));
      const stream = await Promise.race([micPromise, timeout]);
      if (audio?.ctx) {
        const src = audio.ctx.createMediaStreamSource(stream);
        this._analyser = audio.ctx.createAnalyser();
        this._analyser.fftSize = 512;
        this._analyser.smoothingTimeConstant = 0.6;
        src.connect(this._analyser);
        this._buf = new Uint8Array(this._analyser.fftSize);
      }
      this._startRec();
    } catch {
      this.micDenied = true;
      this.fallback = true;
    }
  }

  setEnabled(v) {
    this.enabled = v;
    if (!v) {
      this._rec?.stop();
      this.listening = false;
      this.fallback = true;
    } else if (this.micDenied) {
      this.fallback = true;
    } else if (this._rec) {
      this._startRec();
      this.fallback = false;
    }
  }

  _startRec() {
    if (!this.supported || !this.enabled) { this.fallback = true; return; }
    try {
      this._rec = new Rec();
      this._rec.continuous = true;
      this._rec.interimResults = true;
      this._rec.lang = 'en-US';
      this._rec.onresult = (ev) => {
        let text = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          text += ev.results[i][0].transcript + ' ';
        }
        this._ingest(text, ev.results[ev.results.length - 1].isFinal);
      };
      this._rec.onend = () => {
        if (this.enabled && !this.micDenied && this._rec) {
          try { this._rec.start(); } catch { /* already started */ }
        }
      };
      this._rec.onerror = (e) => {
        if (e.error === 'not-allowed') { this.micDenied = true; this.fallback = true; }
      };
      this._rec.start();
      this.listening = true;
    } catch {
      this.fallback = true;
    }
  }

  _ingest(text, isFinal) {
    const t = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return;
    this.transcript = t;
    this.lastAt = performance.now();
    this.speaking = true;
    this.flags.self = NAME_SELF.test(t);
    this.flags.bound = NAME_BOUND.test(t);
    this.flags.still = STILL.test(t);
    const m = t.match(NAME_FRAG);
    this.flags.frag = m ? m[1] : '';
    if (isFinal) this.lastPhrase = t;
  }

  /** Keyboard fallback: hold V whisper, B talk, N shout. */
  setHold(level) { this.holdTalk = level; }

  speakFallback(phrase, level) {
    this._ingest(phrase, true);
    this.holdTalk = level;
    this.lastAt = performance.now();
  }

  update(dt) {
    if (this._analyser && this._buf) {
      this._analyser.getByteTimeDomainData(this._buf);
      let sum = 0;
      for (let i = 0; i < this._buf.length; i++) {
        const v = (this._buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this._buf.length);
      this._rms = lerp(this._rms, rms, 1 - Math.exp(-12 * dt));
      this.volume = clamp01(this._rms * 7.5);
    } else if (this.fallback) {
      const target = this.holdTalk === 3 ? 0.72 : this.holdTalk === 2 ? 0.32 : this.holdTalk === 1 ? 0.09 : 0;
      this.volume = lerp(this.volume, target, 1 - Math.exp(-10 * dt));
      if (this.holdTalk && performance.now() - this.lastAt > 80) this.speaking = this.holdTalk > 0;
    } else {
      this.volume *= Math.exp(-4 * dt);
    }

    if (performance.now() - this.lastAt > 900) {
      this.speaking = false;
      this.transcript = '';
      this.flags.self = this.flags.bound = this.flags.still = false;
      this.flags.frag = '';
    }

    if (this.volume < 0.035) this.mode = 'silent';
    else if (this.volume < 0.12) this.mode = 'whisper';
    else if (this.volume < 0.38) this.mode = 'talk';
    else this.mode = 'shout';

    this.peak = Math.max(this.peak * Math.exp(-1.8 * dt), this.volume);
  }

  /** Sound power the saint hears from the player's voice. */
  soundPower() {
    if (this.mode === 'silent') return 0;
    if (this.mode === 'whisper') return 3.2;
    if (this.mode === 'talk') return 14;
    return 38;
  }
}
