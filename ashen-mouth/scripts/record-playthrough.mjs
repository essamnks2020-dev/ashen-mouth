/**
 * Drive ASHEN MOUTH via window.__AM and capture a JPEG after each beat â†’ ffmpeg MP4.
 */
import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { createReadStream, statSync, existsSync } from 'fs';
import { extname } from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'qa-audit', 'playthrough-frames');
const OUT_MP4 = path.join(ROOT, 'playthrough.mp4');
const OUT_DESKTOP = path.join(ROOT, '..', 'ASHEN_MOUTH_playthrough.mp4');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DBG = 9466;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
};

function findFfmpeg() {
  const found = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      let st; try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (name.toLowerCase() === 'ffmpeg.exe') found.push(p);
    }
  };
  walk(path.join(ROOT, 'qa-audit', 'ffmpeg'));
  found.push(path.join(ROOT, 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'));
  for (const c of [...found, 'ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe']) {
    try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch { /* */ }
  }
  return null;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let url = decodeURIComponent((req.url || '/').split('?')[0]);
      if (url === '/') url = '/index.html';
      const file = path.join(ROOT, url.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
        res.writeHead(404); res.end('missing'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { server, url } = await startStaticServer();
  console.log('serving', url);

  const profile = path.join(ROOT, 'qa-audit', `rec-${DBG}`);
  fs.mkdirSync(profile, { recursive: true });
  spawn(CHROME, [
    `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--disable-first-run-ui',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720', '--enable-webgl', '--use-angle=d3d11',
    'about:blank',
  ], { stdio: 'ignore', detached: true }).unref();

  let version = null;
  for (let i = 0; i < 60; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${DBG}/json/version`)).json(); break; }
    catch { await sleep(250); }
  }
  if (!version) throw new Error('no chrome');
  console.log(version.Browser);

  const bws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, e) => { bws.onopen = r; bws.onerror = e; });
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    bws.send(JSON.stringify({ id: mid, method, params, sessionId }));
  });
  let sessionId;
  bws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id != null && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  const S = (m, p = {}) => send(m, p, sessionId);
  await S('Page.enable');
  await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  let frameN = 0;
  const shot = async (label) => {
    await sleep(80);
    const { data } = await S('Page.captureScreenshot', { format: 'jpeg', quality: 78 });
    const name = path.join(OUT_DIR, `f${String(frameN++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(name, Buffer.from(data, 'base64'));
    if (label) console.log('shot', label, frameN);
  };
  const burst = async (n, label, gap = 90) => {
    for (let i = 0; i < n; i++) { await shot(i === 0 ? label : null); await sleep(gap); }
  };

  await S('Page.navigate', { url: `${url}/?tour=1` });
  for (let i = 0; i < 120; i++) {
    const { result } = await S('Runtime.evaluate', {
      expression: '!!(window.__AM&&window.__AM.ready)', returnByValue: true,
    });
    if (result.value) break;
    await sleep(150);
  }
  console.log('ready â€” slow tour');

  const t0 = Date.now();
  const LIMIT_MS = 165000;
  let lastMode = '';
  while (Date.now() - t0 < LIMIT_MS) {
    await shot();
    const { result } = await S('Runtime.evaluate', {
      expression: 'window.__AM ? window.__AM.mode() : ""', returnByValue: true,
    });
    const mode = result.value;
    if (mode !== lastMode) { console.log('mode', mode, 't', ((Date.now() - t0) / 1000).toFixed(1)); lastMode = mode; }
    if (mode === 'win' || mode === 'lose') {
      await burst(8, mode, 180);
      break;
    }
    await sleep(320);
  }

  const { result } = await S('Runtime.evaluate', {
    expression: 'window.__AM ? JSON.stringify(window.__AM.state()) : "{}"',
    returnByValue: true,
  });
  console.log('final', result.value);

  await send('Target.closeTarget', { targetId }).catch(() => {});
  bws.close();
  server.close();
  console.log('frames', frameN);

  if (frameN < 20) throw new Error('too few frames: ' + frameN);

  let ffmpeg = findFfmpeg();
  for (let i = 0; !ffmpeg && i < 40; i++) {
    console.log('waiting ffmpeg', i);
    await sleep(3000);
    ffmpeg = findFfmpeg();
  }
  if (!ffmpeg) {
    fs.writeFileSync(path.join(ROOT, 'playthrough-FRAMES.txt'),
      `ffmpeg missing. ${frameN} frames at ${OUT_DIR}`);
    throw new Error('ffmpeg missing');
  }
  console.log('encode', ffmpeg);
  execFileSync(ffmpeg, [
    '-y', '-framerate', '4',
    '-i', path.join(OUT_DIR, 'f%05d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-crf', '20', '-movflags', '+faststart',
    OUT_MP4,
  ], { stdio: 'inherit' });
  fs.copyFileSync(OUT_MP4, OUT_DESKTOP);
  console.log('WROTE', OUT_MP4);
  console.log('WROTE', OUT_DESKTOP);
}

main().catch((e) => { console.error(e); process.exit(1); });
