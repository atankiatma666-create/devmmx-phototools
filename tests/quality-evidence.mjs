// Before/after evidence for compression quality (Stage 2A).
// Runs the real compressor UI in Chromium on a site folder, downloads each result, then measures it.
//
//   SITE_DIR=<site folder> OUT=<output folder> LABEL=<name> node tests/quality-evidence.mjs
//
// For each scenario it records the output bytes, pixels and encoder quality setting shown by the tool,
// plus PSNR and SSIM (luma) against the original at two viewing scales:
//   "screen": both scaled to 1000 px wide (roughly a phone screen showing the whole picture)
//   "zoom":   both at the original's full pixel size (like zooming in to inspect detail)
// These are simple, limited measures. They do not guarantee that faces or text are readable.
// It also saves crops of the same text area scaled to the same on-screen size, for visual inspection.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('./', import.meta.url));
const SITE = resolve(process.env.SITE_DIR || join(HERE, '..', 'site'));
const OUT = resolve(process.env.OUT || join(HERE, 'results', 'evidence'));
const LABEL = process.env.LABEL || 'current';
const FIX = join(HERE, 'fixtures');
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let f = join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const SCENARIOS = [
  { fixture: 'detailed.jpg', kb: 50, resize: true },
  { fixture: 'detailed.jpg', kb: 100, resize: true },
  { fixture: 'detailed.jpg', kb: 200, resize: true },
  { fixture: 'detailed.jpg', kb: 200, resize: false },
  { fixture: 'detailed.jpg', kb: 100, resize: false },
  { fixture: 'photo.jpg', kb: 50, resize: true },
  { fixture: 'photo.jpg', kb: 150, resize: true },
  { fixture: 'photo.jpg', kb: 150, resize: false }
];
// Region (in original pixels) shown at 1:1 for the "zoom" view, per fixture
const ZOOM = { 'detailed.jpg': { x: 250, y: 1150, w: 600, h: 400 }, 'photo.jpg': { x: 1200, y: 800, w: 600, h: 400 } };

const browser = await chromium.launch();
const rows = [];
for (const sc of SCENARIOS) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/compress-image-to-kb/');
  await page.setInputFiles('#file-input', join(FIX, sc.fixture));
  await page.waitForFunction(() => /Image ready/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
  await page.check('input[name="target"][value="custom"]');
  await page.fill('#custom-kb', String(sc.kb));
  if (sc.resize) await page.check('#allow-resize');
  await page.click('#compress-btn');
  await page.waitForFunction(() => document.getElementById('tool').getAttribute('aria-busy') === 'false' &&
    (!document.getElementById('result').hidden || !document.getElementById('error').hidden), null, { timeout: 180000 });
  const name = `${LABEL}-${sc.fixture.replace(/\W/g, '_')}-${sc.kb}kb-resize-${sc.resize ? 'on' : 'off'}`;
  if (await page.isHidden('#result')) {
    rows.push({ name, error: (await page.textContent('#error')).replace(/\s+/g, ' ') });
    await ctx.close(); continue;
  }
  const quality = (await page.textContent('#res-quality')).trim();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const path = join(OUT, name + '.jpg');
  await dl.saveAs(path);
  const out = readFileSync(path);
  const orig = readFileSync(join(FIX, sc.fixture));
  // Measure in a blank page (no CSP restrictions on our own canvas work)
  const m = await (await ctx.newPage()).evaluate(async ({ o, r, crop }) => {
    const dec = async (b64, type) => createImageBitmap(new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type }));
    const A = await dec(o, 'image/jpeg'), B = await dec(r, 'image/jpeg');
    const lumaAt = (bm, W, H) => {
      const c = new OffscreenCanvas(W, H); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bm, 0, 0, W, H);
      const d = x.getImageData(0, 0, W, H).data; const y = new Float32Array(W * H);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) y[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      return y;
    };
    const metrics = (W) => {
      const H = Math.round(W * A.height / A.width);
      const a = lumaAt(A, W, H), b = lumaAt(B, W, H);
      let se = 0; for (let i = 0; i < a.length; i++) se += (a[i] - b[i]) ** 2;
      const psnr = 10 * Math.log10(255 * 255 / (se / a.length));
      // Mean SSIM over non-overlapping 8x8 windows
      const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2; let sum = 0, n = 0;
      for (let y0 = 0; y0 + 8 <= H; y0 += 8) for (let x0 = 0; x0 + 8 <= W; x0 += 8) {
        let ma = 0, mb = 0; for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) { ma += a[y * W + x]; mb += b[y * W + x]; }
        ma /= 64; mb /= 64; let va = 0, vb = 0, cov = 0;
        for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) { const da = a[y * W + x] - ma, db = b[y * W + x] - mb; va += da * da; vb += db * db; cov += da * db; }
        va /= 63; vb /= 63; cov /= 63;
        sum += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
      }
      return { psnr, ssim: sum / n };
    };
    const screen = metrics(1000), zoom = metrics(A.width);
    const png = async (c) => {
      const blob = await c.convertToBlob({ type: 'image/png' });
      return new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
    };
    // "screen": whole result drawn 1000 px wide. "zoom": the same original region at 1:1 original pixels
    // (a smaller result is enlarged to the original scale, as a phone does when you zoom in).
    const sc = new OffscreenCanvas(1000, Math.round(1000 * A.height / A.width)); const sx = sc.getContext('2d');
    sx.imageSmoothingQuality = 'high'; sx.drawImage(B, 0, 0, sc.width, sc.height);
    const z = new OffscreenCanvas(crop.w, crop.h); const zx = z.getContext('2d'); zx.imageSmoothingQuality = 'high';
    const k = B.width / A.width;
    zx.drawImage(B, crop.x * k, crop.y * k, crop.w * k, crop.h * k, 0, 0, crop.w, crop.h);
    const cropPng = { screen: await png(sc), zoom: await png(z) };
    return { w: B.width, h: B.height, screen, zoom, cropPng };
  }, { o: orig.toString('base64'), r: out.toString('base64'), crop: ZOOM[sc.fixture] });
  writeFileSync(join(OUT, name + '-screen.png'), Buffer.from(m.cropPng.screen, 'base64'));
  writeFileSync(join(OUT, name + '-zoom.png'), Buffer.from(m.cropPng.zoom, 'base64'));
  delete m.cropPng;
  rows.push({ name, bytes: out.length, limit: sc.kb * 1024, dims: `${m.w}x${m.h}`, quality, m });
  await ctx.close();
}
await browser.close(); server.close();
const lines = rows.map((r) => r.error ? `${r.name}: NO RESULT: ${r.error.slice(0, 160)}`
  : `${r.name}: ${r.bytes} bytes (limit ${r.limit}), ${r.dims}, encoder setting ${r.quality}; screen PSNR ${r.m.screen.psnr.toFixed(2)} dB SSIM ${r.m.screen.ssim.toFixed(4)}; zoom PSNR ${r.m.zoom.psnr.toFixed(2)} dB SSIM ${r.m.zoom.ssim.toFixed(4)}`);
writeFileSync(join(OUT, `${LABEL}-summary.txt`), lines.join('\n') + '\n');
console.log(lines.join('\n'));
