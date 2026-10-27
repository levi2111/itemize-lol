/* node scripts/og-glyphs.ts. Rasterises the glyphs the preview images draw text with (STYLES in
   src/og/font.ts) and writes them to src/og/glyphs.bin. Run it after changing STYLES or the fonts;
   the build and the Worker only read the result. It needs Chrome: it starts its own headless copy
   (CHROME names the executable when it is not in the usual place) and lets Chrome's text renderer
   draw each glyph from the site's own font files, so the cards' text looks like the site's.
   The file is deflated; scripts/bundle.ts inflates it for the Worker. */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { ROOT } from '../src/pipeline/paths.ts';
import { STYLES, type AtlasHeader } from '../src/og/font.ts';

const chrome = process.env.CHROME ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome not found: set CHROME to its executable');
const profile = mkdtempSync(join(tmpdir(), 'og-glyphs-'));
const proc = spawn(chrome, ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

try {
  // Chrome writes the port it chose into the profile
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await new Promise(r => setTimeout(r, 100));
    try { port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch {}
  }
  const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json() as { type: string; webSocketDebuggerUrl: string }[]).find(t => t.type === 'page')!;
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const waiting = new Map<number, (m: any) => void>();
  ws.onmessage = e => { const m = JSON.parse(String(e.data)); waiting.get(m.id)?.(m); waiting.delete(m.id); };
  const evaluate = (expression: string) => new Promise<any>((res, rej) => {
    const n = ++id;
    waiting.set(n, m => m.result?.exceptionDetails ? rej(new Error(m.result.exceptionDetails.exception?.description ?? 'failed')) : res(m.result?.result?.value));
    ws.send(JSON.stringify({ id: n, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });

  // in the page: one glyph at a time, white on transparent, cropped to what it covers
  const draw = async (name: string, spec: { font: string; weight: number; stretch: number; size: number; chars: string }, font: string) => {
    const bytes = Uint8Array.from(atob(font), c => c.charCodeAt(0));
    const face = new FontFace('og-' + name, bytes.buffer, { weight: String(spec.weight), stretch: spec.stretch + '%' });
    await face.load();
    (document as any).fonts.add(face);
    const S = spec.size, W = S * 3, H = S * 2, base = Math.round(S * 1.4), x0 = Math.round(S * 0.5);
    const cv = new OffscreenCanvas(W, H), ctx = cv.getContext('2d', { willReadFrequently: true })!;
    ctx.font = `${spec.weight} ${S}px og-${name}`;
    ctx.fontKerning = 'normal';
    ctx.fillStyle = '#fff';
    const chars = [...spec.chars], adv: Record<string, number> = {}, glyphs: Record<string, [number, number, number, number, number[]]> = {};
    for (const ch of chars) {
      adv[ch] = ctx.measureText(ch).width;
      ctx.clearRect(0, 0, W, H);
      ctx.fillText(ch, x0, base);
      const d = ctx.getImageData(0, 0, W, H).data;
      let x1 = W, y1 = H, x2 = -1, y2 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3]) { x1 = Math.min(x1, x); x2 = Math.max(x2, x); y1 = Math.min(y1, y); y2 = Math.max(y2, y); }
      if (x2 < 0) { glyphs[ch] = [0, 0, 0, 0, []]; continue; }
      const a: number[] = [];
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) a.push(d[(y * W + x) * 4 + 3]!);
      glyphs[ch] = [x2 - x1 + 1, y2 - y1 + 1, x1 - x0, base - y1, a];
    }
    const kern: Record<string, number> = {};
    for (const p of chars) for (const q of chars) {
      const k = ctx.measureText(p + q).width - adv[p]! - adv[q]!;
      if (Math.abs(k) >= 0.25) kern[p + q] = Math.round(k * 100) / 100;
    }
    return { ascent: ctx.measureText('H').actualBoundingBoxAscent, adv, glyphs, kern };
  };

  const head: AtlasHeader = { styles: {} };
  const maps: Uint8Array[] = [];
  let at = 0;
  for (const [name, spec] of Object.entries(STYLES)) {
    const font = readFileSync(join(ROOT, 'web', 'fonts', spec.font)).toString('base64');
    const r = await evaluate(`(${draw.toString()})(${JSON.stringify(name)}, ${JSON.stringify(spec)}, ${JSON.stringify(font)})`);
    const s: AtlasHeader['styles'][string] = { size: spec.size, ascent: Math.round(r.ascent), glyphs: {}, kern: r.kern };
    for (const [ch, [w, h, left, top, a]] of Object.entries(r.glyphs as Record<string, [number, number, number, number, number[]]>)) {
      s.glyphs[ch] = [at, w, h, left, top, Math.round(r.adv[ch] * 100) / 100];
      maps.push(Uint8Array.from(a));
      at += a.length;
    }
    head.styles[name] = s;
    console.log(`${name.padEnd(10)} ${Object.keys(s.glyphs).length} glyphs, ${Object.keys(s.kern).length} kerning pairs`);
  }
  ws.close();
  const json = new TextEncoder().encode(JSON.stringify(head));
  const out = new Uint8Array(4 + json.length + at);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  let o = 4 + json.length;
  for (const m of maps) { out.set(m, o); o += m.length; }
  const packed = deflateRawSync(out, { level: 9 });
  writeFileSync(join(ROOT, 'src', 'og', 'glyphs.bin'), packed);
  console.log(`src/og/glyphs.bin: ${(out.length / 1024).toFixed(0)} KB, ${(packed.length / 1024).toFixed(0)} KB deflated`);
} finally {
  proc.kill();
  await new Promise(r => setTimeout(r, 300));
  rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
}
