/**
 * Full playthrough recorder for ASHEN MOUTH.
 * Uses Puppeteer-core + installed Chrome + CDP screencast → PNG frames → ffmpeg MP4.
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
const CHROME = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.wasm': 'application/wasm', '.map': 'application/json',
};

function findFfmpeg() {
  const candidates = [
    'ffmpeg',
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe'),
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ['-version'], { stdio: 'ignore' });
      return c;
    } catch { /* next */ }
  }
  // winget shim search
  try {
    const out = execFileSync('where.exe', ['ffmpeg'], { encoding: 'utf8' });
    const line = out.split(/\r?\n/).find(Boolean);
    if (line) return line.trim();
  } catch { /* none */ }
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
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { server, url } = await startStaticServer();
  console.log('serving', url);

  // Launch Chrome with remote debugging
  const profile = path.join(ROOT, 'qa-audit', 'rec-profile');
  fs.mkdirSync(profile, { recursive: true });
  const chrome = spawn(CHROME, [
    `--remote-debugging-port=9333`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-first-run-ui',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720',
    '--enable-webgl',
    '--use-angle=d3d11',
    'about:blank',
  ], { stdio: 'ignore', detached: true });
  chrome.unref();
  await sleep(2500);

  const version = await (await fetch('http://127.0.0.1:9333/json/version')).json();
  const bws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, e) => { bws.onopen = r; bws.onerror = e; });

  let id = 0;
  const pending = new Map();
  const send = (method, params = {}, sessionId) => {
    const mid = ++id;
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject });
      bws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
  };
  let frameN = 0;
  let sessionId = null;
  bws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id != null && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
      return;
    }
    if (m.method === 'Page.screencastFrame' && m.sessionId === sessionId) {
      const { data, sessionId: sid } = m.params;
      const name = path.join(OUT_DIR, `f${String(frameN++).padStart(5, '0')}.jpg`);
      fs.writeFileSync(name, Buffer.from(data, 'base64'));
      send('Page.screencastFrameAck', { sessionId: sid }, sessionId).catch(() => {});
    }
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  const S = (method, params = {}) => send(method, params, sessionId);

  await S('Page.enable');
  await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  const tourUrl = `${url}/?tour=1&v=rec`;
  console.log('navigate', tourUrl);
  await S('Page.navigate', { url: tourUrl });

  // Wait for __AM
  for (let i = 0; i < 60; i++) {
    const { result } = await S('Runtime.evaluate', {
      expression: '!!(window.__AM && window.__AM.ready)',
      returnByValue: true,
    });
    if (result.value) break;
    await sleep(250);
  }
  console.log('__AM ready');

  await S('Page.startScreencast', {
    format: 'jpeg',
    quality: 72,
    maxWidth: 1280,
    maxHeight: 720,
    everyNthFrame: 2,
  });

  // Tour runs itself (~45–55s). Poll until win or timeout.
  const t0 = Date.now();
  let lastMode = '';
  while (Date.now() - t0 < 90000) {
    const { result } = await S('Runtime.evaluate', {
      expression: 'window.__AM ? JSON.stringify(window.__AM.state()) : "{}"',
      returnByValue: true,
    });
    let st = {};
    try { st = JSON.parse(result.value || '{}'); } catch { /* */ }
    if (st.mode && st.mode !== lastMode) {
      console.log('mode', st.mode, 'zone', st.zone, 'end', st.end, 'frames', frameN);
      lastMode = st.mode;
    }
    if (st.mode === 'win' || st.end === 'bind') {
      await sleep(2800);
      break;
    }
    await sleep(500);
  }

  await S('Page.stopScreencast').catch(() => {});
  await sleep(400);
  await send('Target.closeTarget', { targetId }).catch(() => {});
  bws.close();
  server.close();

  console.log('frames', frameN);
  if (frameN < 30) {
    console.error('Too few frames — aborting encode');
    process.exit(1);
  }

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error('ffmpeg not found — leaving frames in', OUT_DIR);
    process.exit(2);
  }
  console.log('encoding with', ffmpeg);
  // ~15 fps effective with everyNthFrame=2 on 60hz-ish
  const args = [
    '-y', '-framerate', '15',
    '-i', path.join(OUT_DIR, 'f%05d.jpg'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    '-crf', '22', '-movflags', '+faststart',
    OUT_MP4,
  ];
  execFileSync(ffmpeg, args, { stdio: 'inherit' });
  fs.copyFileSync(OUT_MP4, OUT_DESKTOP);
  console.log('WROTE', OUT_MP4);
  console.log('WROTE', OUT_DESKTOP);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
