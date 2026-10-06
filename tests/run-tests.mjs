// End-to-end browser tests for devMmX PhotoTools.
// Run: node tests/generate-fixtures.mjs && node tests/run-tests.mjs
// Options (environment variables):
//   SITE_DIR     folder to serve (default: ./site). Its parent may hold site.config.json;
//                if so, canonical links, sitemap, owner name and email are checked against it.
//   RESULTS_DIR  where report.txt, screenshots and downloads go (default: tests/results)
// Serves ./site on a local port (404.html for unknown paths, like Cloudflare Pages),
// drives Chromium with Playwright, and writes tests/results/report.txt and screenshots.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const HERE = new URL('./', import.meta.url).pathname;
const SITE = process.env.SITE_DIR ? resolve(process.env.SITE_DIR) : join(HERE, '..', 'site');
const FIX = join(HERE, 'fixtures');
const OUT = process.env.RESULTS_DIR ? resolve(process.env.RESULTS_DIR) : join(HERE, 'results');
const CFG_FILE = join(SITE, '..', 'site.config.json');
const CFG = existsSync(CFG_FILE) ? JSON.parse(readFileSync(CFG_FILE, 'utf8')) : {};
const EXPECT = {
  origin: 'https://' + (CFG.domain || 'YOUR-DOMAIN.example'),
  name: CFG.name || 'OWNER-NAME-PLACEHOLDER',
  email: CFG.email || 'CONTACT-EMAIL-PLACEHOLDER'
};
const MODE = CFG.domain && CFG.name && CFG.email ? 'configured' : 'template';
mkdirSync(join(OUT, 'screens'), { recursive: true });
mkdirSync(join(OUT, 'downloads'), { recursive: true });
if (!existsSync(join(FIX, 'photo.jpg'))) { console.error('Run node tests/generate-fixtures.mjs first.'); process.exit(2); }

// ---------- Static server ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const serverLog = [];
const server = http.createServer((req, res) => {
  let body = [];
  req.on('data', (c) => body.push(c));
  req.on('end', () => {
    const size = Buffer.concat(body).length;
    serverLog.push({ method: req.method, url: req.url, bodyBytes: size });
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(SITE, p);
    if (!file.startsWith(SITE)) { res.writeHead(400); return res.end(); }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404, { 'content-type': TYPES['.html'] }); return res.end(readFileSync(join(SITE, '404.html'))); }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- Tiny test harness ----------
const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false, ms: Date.now() - t0, err: e.message }); console.log('FAIL ' + name + '\n     ' + e.message); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

// ---------- JPEG inspection in Node ----------
function jpegInfo(buf) {
  assert(buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF, 'output does not start with JPEG signature FF D8 FF');
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xFF) throw new Error('bad marker');
    const m = buf[i + 1];
    if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error('no SOF');
}

const browser = await chromium.launch();
const decoderPage = await browser.newPage();
await decoderPage.goto('about:blank');
// Decode bytes with the browser's image decoder, as image/jpeg, and sample pixels.
async function browserDecode(buf, samples = []) {
  return decoderPage.evaluate(async ({ b64, samples }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
    const c = new OffscreenCanvas(bmp.width, bmp.height); const ctx = c.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    const px = samples.map(([fx, fy]) => Array.from(ctx.getImageData(Math.floor(fx * bmp.width), Math.floor(fy * bmp.height), 1, 1).data));
    return { width: bmp.width, height: bmp.height, px };
  }, { b64: buf.toString('base64'), samples });
}

// ---------- Page helpers ----------
const INSTRUMENT = () => {
  // Track object URLs, and optionally slow down JPEG encoding to test replacement mid-run.
  window.__live = new Set();
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (o) => { const u = c(o); window.__live.add(u); return u; };
  URL.revokeObjectURL = (u) => { window.__live.delete(u); return r(u); };
  window.__slow = 0; window.__encodes = 0;
  const tb = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (cb, type, q) {
    if (type === 'image/jpeg') window.__encodes++;
    const delay = window.__slow;
    return tb.call(this, (b) => (delay ? setTimeout(() => cb(b), delay) : cb(b)), type, q);
  };
};

async function openTool(context) {
  const page = await context.newPage();
  const requests = [];
  page.on('request', (r) => requests.push({ url: r.url(), method: r.method(), post: r.postData() }));
  await page.addInitScript(INSTRUMENT);
  await page.goto(BASE + '/compress-image-to-kb/');
  return { page, requests };
}
async function choose(page, name) {
  await page.setInputFiles('#file-input', join(FIX, name));
  await page.waitForFunction(() => {
    const s = document.getElementById('status').textContent;
    return s.startsWith('Image ready') || !document.getElementById('error').hidden;
  }, null, { timeout: 30000 });
}
async function setTarget(page, kb) {
  if ([20, 50, 100, 200].includes(kb)) await page.check(`input[name="target"][value="${kb}"]`);
  else if (kb === 'custom') await page.check('input[name="target"][value="custom"]');
  else { await page.check('input[name="target"][value="custom"]'); await page.fill('#custom-kb', String(kb)); }
}
async function compress(page) {
  await page.click('#compress-btn');
  await page.waitForFunction(() => document.getElementById('tool').getAttribute('aria-busy') === 'false' &&
    (!document.getElementById('result').hidden || !document.getElementById('error').hidden), null, { timeout: 120000 });
}
async function download(page, label) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#download')]);
  const path = join(OUT, 'downloads', label + '-' + dl.suggestedFilename());
  await dl.saveAs(path);
  return { buf: readFileSync(path), name: dl.suggestedFilename() };
}
const errText = (page) => page.$eval('#error', (e) => (e.hidden ? '' : e.textContent));
const visible = (page, sel) => page.$eval(sel, (e) => !e.hidden);

async function expectSuccess(name, fixture, kb, { resize = false, sameDims = true, samples = [] } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  try {
    const { page, requests } = await openTool(ctx);
    await choose(page, fixture);
    assert(!(await visible(page, '#error')), 'unexpected error on load: ' + (await errText(page)));
    const orig = await page.$eval('#orig-dims', (e) => e.textContent);
    await setTarget(page, kb);
    if (resize) await page.check('#allow-resize');
    await compress(page);
    assert(await visible(page, '#result'), 'no result shown; error: ' + (await errText(page)));
    const { buf, name: fname } = await download(page, name.replace(/\W+/g, '_'));
    const limit = kb * 1024;
    assert(buf.length <= limit, `output ${buf.length} bytes exceeds limit ${limit}`);
    assert(fname.endsWith('.jpg'), 'download name not .jpg: ' + fname);
    const sof = jpegInfo(buf);
    const dec = await browserDecode(buf, samples);
    assert(dec.width === sof.width && dec.height === sof.height, 'decoded dims differ from JPEG header');
    const [ow, oh] = orig.replace(/,/g, '').match(/\d+/g).map(Number);
    if (sameDims) assert(dec.width === ow && dec.height === oh, `dimensions changed: ${ow}x${oh} -> ${dec.width}x${dec.height}`);
    else {
      assert(dec.width < ow && dec.height < oh, 'expected smaller dimensions');
      assert(Math.abs(dec.width / dec.height - ow / oh) < 0.01, 'aspect ratio not preserved');
    }
    const shown = await page.$eval('#res-size', (e) => e.textContent);
    assert(shown.includes(buf.length.toLocaleString('en-US') + ' bytes'), `UI size "${shown}" does not match file ${buf.length}`);
    // blob: URLs are in-memory previews inside the tab, not network traffic
    const bad = requests.filter((r) => r.method !== 'GET' || r.post || !(r.url.startsWith(BASE) || r.url.startsWith('blob:' + BASE)));
    assert(bad.length === 0, 'unexpected network requests: ' + JSON.stringify(bad));
    return { page, buf, dec, orig: [ow, oh], detail: `${fixture} -> ${buf.length} bytes (limit ${limit}), ${dec.width}x${dec.height}` };
  } finally { await ctx.close(); }
}

// =================== TESTS ===================
const details = {};

await test('Success: 3000x2000 JPEG to 100 KB, quality only, dimensions unchanged', async () => {
  const r = await expectSuccess('jpg100', 'photo.jpg', 100); details.jpg100 = r.detail;
});
await test('Success: 1600x1200 WebP to 50 KB', async () => {
  const r = await expectSuccess('webp50', 'photo.webp', 50); details.webp50 = r.detail;
});
await test('Success: custom 75 KB limit', async () => {
  const r = await expectSuccess('custom75', 'photo.jpg', 75); details.custom75 = r.detail;
});
await test('Success: PNG with .jpg extension is detected by content', async () => {
  const r = await expectSuccess('pngnamedjpg', 'png-named-as.jpg', 20); details.pngnamedjpg = r.detail;
});
await test('Success with resize: noisy 2000x1500 PNG to 20 KB, smaller dims, same aspect ratio', async () => {
  const r = await expectSuccess('noise20resize', 'noisy.png', 20, { resize: true, sameDims: false }); details.noise20resize = r.detail;
});
await test('Transparency: notice shown and transparent area becomes white', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'transparent.png');
  assert(await visible(page, '#alpha-note'), 'transparency notice not shown');
  await setTarget(page, 50); await compress(page);
  const { buf } = await download(page, 'transparent');
  const dec = await browserDecode(buf, [[0.1, 0.5], [0.25, 0.2]]);
  for (const p of dec.px) assert(p[0] >= 250 && p[1] >= 250 && p[2] >= 250, 'transparent area not white: ' + p);
  details.transparent = `${buf.length} bytes; sampled pixels ${JSON.stringify(dec.px)}`;
  // Opaque image must not show the notice
  await choose(page, 'photo.webp');
  assert(!(await visible(page, '#alpha-note')), 'transparency notice shown for opaque image');
  await ctx.close();
});
await test('Metadata: EXIF block in input is not present in output', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'exif.jpg'); await setTarget(page, 200); await compress(page);
  const { buf } = await download(page, 'exif');
  assert(!buf.includes(Buffer.from('FAKE-GPS')) && !buf.includes(Buffer.from('Exif')), 'EXIF data found in output');
  await ctx.close();
});
await test('Impossible target: 20 KB on noisy PNG without resize gives error, no download', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'noisy.png'); await setTarget(page, 20); await compress(page);
  const e = await errText(page);
  assert(e.includes('Could not get this image under 20 KB'), 'missing impossible message: ' + e);
  assert(e.includes('Allow smaller dimensions'), 'missing resize suggestion');
  assert(!(await visible(page, '#result')), 'result shown despite failure');
  assert((await page.$eval('#download', (a) => a.getAttribute('href'))) === null, 'download link present');
  const n = await page.evaluate(() => window.__encodes);
  assert(n <= 40, 'too many encodes: ' + n);
  details.impossible = e.replace(/\s+/g, ' ').slice(0, 200) + ` [encodes: ${n}]`;
  await ctx.close();
});
await test('Already-small JPEG: note says it is already under the limit', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'small.jpg');
  const note = await page.$eval('#orig-note', (e) => e.textContent);
  assert(note.includes('already at or under 50 KB'), 'note missing: ' + note);
  await ctx.close();
});

const BAD = [
  ['random-bytes.jpg', 'not a JPEG, PNG or WebP'],
  ['jpeg-garbage.jpg', 'could not be read as an image'],
  ['truncated.jpg', 'incomplete'],
  ['text-renamed.png', 'not a JPEG, PNG or WebP'],
  ['huge-dimensions.png', '20,000 × 20,000'],
  ['bad-data.png', 'could not be opened'],
  ['animation.gif', 'GIF file'],
  ['photo.heic', 'HEIC'],
  ['empty.jpg', 'is empty'],
  ['oversized.jpg', 'largest file this tool accepts']
];
for (const [file, expect] of BAD) {
  await test(`Rejects ${file} with a clear error`, async () => {
    const ctx = await browser.newContext();
    const { page } = await openTool(ctx);
    await choose(page, file);
    const e = await errText(page);
    assert(e.includes(expect), `expected "${expect}", got "${e}"`);
    assert(await page.$eval('#compress-btn', (b) => b.disabled), 'compress button enabled after bad file');
    assert(!(await visible(page, '#original')), 'original panel shown for bad file');
    details['bad:' + file] = e.replace(/\s+/g, ' ').slice(0, 160);
    await ctx.close();
  });
}

await test('Custom limit validation', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp');
  await setTarget(page, 'abc'); await page.click('#compress-btn');
  assert((await errText(page)).includes('whole number'), 'no error for text input');
  await page.fill('#custom-kb', '3'); await page.click('#compress-btn');
  assert((await errText(page)).includes('between 5 KB and 20,480 KB'), 'no range error');
  await page.fill('#custom-kb', '75');
  assert((await page.$eval('#custom-bytes', (e) => e.textContent)) === 'Selected limit: 75 KB = 76,800 bytes', 'byte conversion wrong');
  await ctx.close();
});

await test('Reset clears image, result, download link and releases object URLs', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 50); await compress(page);
  assert(await page.evaluate(() => window.__live.size) === 2, 'expected 2 live URLs (preview + result)');
  await page.check('#allow-resize');  // changing an option clears a stale result
  assert(!(await visible(page, '#result')), 'result still visible after option change');
  await page.click('#reset-btn');
  const st = await page.evaluate(() => ({
    live: window.__live.size, file: document.getElementById('file-input').value,
    href: document.getElementById('download').getAttribute('href'),
    result: document.getElementById('result').hidden, orig: document.getElementById('original').hidden,
    btn: document.getElementById('compress-btn').disabled, resize: document.getElementById('allow-resize').checked,
    target: document.querySelector('input[name=target]:checked').value
  }));
  assert(st.live === 0, 'object URLs not revoked: ' + st.live);
  assert(st.file === '' && st.href === null && st.result && st.orig && st.btn && !st.resize && st.target === '50', 'reset incomplete: ' + JSON.stringify(st));
  await ctx.close();
});

await test('Replacing the image during processing cancels the old run (no stale result or download)', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'noisy.png'); await setTarget(page, 20); await page.check('#allow-resize');
  await page.evaluate(() => { window.__slow = 400; });
  await page.click('#compress-btn');
  await page.waitForFunction(() => /attempt/.test(document.getElementById('status').textContent));
  assert(await page.$eval('#compress-btn', (b) => b.disabled), 'compress button not disabled while busy');
  await choose(page, 'photo.webp');           // replace mid-run
  const status = await page.$eval('#status', (e) => e.textContent);
  await page.waitForTimeout(3000);              // let the old run's pending encodes finish
  const st = await page.evaluate(() => ({
    name: document.getElementById('orig-name').textContent, result: document.getElementById('result').hidden,
    err: document.getElementById('error').hidden, href: document.getElementById('download').getAttribute('href'),
    status: document.getElementById('status').textContent
  }));
  assert(st.name === 'photo.webp' && st.result && st.err && st.href === null, 'stale state after replace: ' + JSON.stringify(st));
  assert(st.status.startsWith('Image ready'), 'status overwritten by old run: ' + st.status);
  await page.evaluate(() => { window.__slow = 0; });
  await setTarget(page, 50); await compress(page);
  const { buf, name } = await download(page, 'replace');
  assert(name.startsWith('photo-under-50kb'), 'download from wrong image: ' + name);
  assert(jpegInfo(buf).width === 1600, 'download has wrong dimensions');
  details.replace = `status after replace began with: "${status.slice(0, 60)}"; final download ${name} ${buf.length} bytes`;
  await ctx.close();
});

await test('Choosing a new image after success removes the old download', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 50); await compress(page);
  await choose(page, 'small.jpg');
  assert((await page.$eval('#download', (a) => a.getAttribute('href'))) === null, 'old download link still present');
  assert(await page.evaluate(() => window.__live.size) === 1, 'old URLs not released');
  await ctx.close();
});

await test('No image data is transmitted (request log, server log, CSP blocks connections)', async () => {
  const before = serverLog.length;
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page, requests } = await openTool(ctx);
  const afterLoad = requests.length;
  await choose(page, 'photo.jpg'); await setTarget(page, 100); await compress(page);
  await download(page, 'network');
  const during = requests.slice(afterLoad).filter((r) => !r.url.startsWith('blob:' + BASE));
  const blobs = requests.slice(afterLoad).length - during.length;
  assert(during.length === 0, 'requests made while processing: ' + JSON.stringify(during));
  const srv = serverLog.slice(before);
  assert(srv.every((r) => r.method === 'GET' && r.bodyBytes === 0), 'server received non-GET or body: ' + JSON.stringify(srv));
  const blocked = await page.evaluate(async (u) => {
    try { await fetch(u, { method: 'POST', body: 'x' }); return false; } catch (e) { return true; }
  }, BASE + '/collect');
  assert(blocked, 'CSP did not block fetch()');
  assert(!serverLog.some((r) => r.url === '/collect'), 'POST reached server');
  details.network = `page requests: ${requests.map((r) => r.method + ' ' + r.url.replace(BASE, '')).join(', ')}; requests during processing: 0 network (${blobs} local blob: preview loads); server saw ${srv.length} GETs with empty bodies; fetch() blocked by CSP`;
  await ctx.close();
});

// ---------- Stage 1.1 regressions ----------
async function startSlow(page, ms = 400) {
  await page.evaluate((d) => { window.__slow = d; }, ms);
  await page.click('#compress-btn');
  await page.waitForFunction(() => /attempt/.test(document.getElementById('status').textContent));
}
async function controlState(page) {
  return page.evaluate(() => ({
    radios: [...document.querySelectorAll('input[name=target]')].map((r) => r.disabled),
    custom: document.getElementById('custom-kb').disabled,
    resize: document.getElementById('allow-resize').disabled,
    file: document.getElementById('file-input').disabled,
    reset: document.getElementById('reset-btn').disabled,
    compress: document.getElementById('compress-btn').disabled,
    busy: document.getElementById('tool').getAttribute('aria-busy'),
    result: !document.getElementById('result').hidden,
    error: !document.getElementById('error').hidden,
    href: document.getElementById('download').getAttribute('href'),
    status: document.getElementById('status').textContent,
    live: window.__live ? window.__live.size : -1
  }));
}
// Changes an option the way a script or extension could, even though the control is disabled.
async function forceChange(page, kind, value) {
  await page.evaluate(({ kind, value }) => {
    if (kind === 'preset') { const r = document.querySelector(`input[name=target][value="${value}"]`); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
    if (kind === 'custom') { const c = document.getElementById('custom-kb'); c.value = value; c.dispatchEvent(new Event('input', { bubbles: true })); }
    if (kind === 'resize') { const c = document.getElementById('allow-resize'); c.checked = value; c.dispatchEvent(new Event('change', { bubbles: true })); }
    if (kind === 'silent') { document.querySelector(`input[name=target][value="${value}"]`).checked = true; }
  }, { kind, value });
}
async function expectStopped(page, label) {
  await page.waitForTimeout(3000);   // let the cancelled run's pending encodes finish
  const st = await controlState(page);
  assert(!st.result && st.href === null, `${label}: outdated result published ${JSON.stringify(st)}`);
  assert(!st.error, `${label}: unexpected error box`);
  assert(st.status.startsWith('Settings changed'), `${label}: status "${st.status}"`);
  assert(st.busy === 'false' && !st.radios.some(Boolean) && !st.resize && !st.compress, `${label}: controls not restored ${JSON.stringify(st)}`);
  return st;
}

await test('Options are locked while compressing; picker and Start over stay usable', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 'custom'); await page.fill('#custom-kb', '150');
  await startSlow(page);
  const st = await controlState(page);
  assert(st.radios.every(Boolean) && st.custom && st.resize && st.compress, 'options not locked: ' + JSON.stringify(st));
  assert(!st.file && !st.reset, 'file picker or Start over disabled during run');
  await page.evaluate(() => { window.__slow = 0; });
  await page.waitForFunction(() => document.getElementById('tool').getAttribute('aria-busy') === 'false');
  const after = await controlState(page);
  assert(after.result && !after.radios.some(Boolean) && !after.custom && !after.resize, 'controls not unlocked after run: ' + JSON.stringify(after));
  await ctx.close();
});

await test('Preset change during a slowed encode cancels the run; new run uses the new limit', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 200);
  await startSlow(page);
  await forceChange(page, 'preset', '50');
  await expectStopped(page, 'preset');
  await page.evaluate(() => { window.__slow = 0; });
  await compress(page);
  assert((await page.textContent('#result-heading')).includes('under your 50 KB limit'), 'heading not for 50 KB');
  const { buf } = await download(page, 'preset-change');
  assert(buf.length <= 50 * 1024, 'download over 50 KB: ' + buf.length);
  details.presetChange = `200 KB run cancelled by switch to 50 KB; new download ${buf.length} bytes`;
  await ctx.close();
});

await test('Custom-limit edit during a slowed encode cancels the run; new run uses the new limit', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 'custom'); await page.fill('#custom-kb', '150');
  await startSlow(page);
  await forceChange(page, 'custom', '60');
  await expectStopped(page, 'custom');
  await page.evaluate(() => { window.__slow = 0; });
  await compress(page);
  assert((await page.textContent('#result-heading')).includes('under your 60 KB limit'), 'heading not for 60 KB');
  const { buf } = await download(page, 'custom-change');
  assert(buf.length <= 60 * 1024, 'download over 60 KB: ' + buf.length);
  details.customChange = `150 KB run cancelled by edit to 60 KB; new download ${buf.length} bytes`;
  await ctx.close();
});

await test('Resize-option change during a slowed encode cancels the run', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'noisy.png'); await setTarget(page, 20);
  await startSlow(page);
  await forceChange(page, 'resize', true);
  await expectStopped(page, 'resize');
  assert(await page.isChecked('#allow-resize'), 'resize option lost');
  await ctx.close();
});

await test('Option changed without an event: finished result is discarded, not published', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'photo.webp'); await setTarget(page, 200);
  await startSlow(page, 150);
  await forceChange(page, 'silent', '20');
  await page.evaluate(() => { window.__slow = 0; });
  await page.waitForFunction(() => document.getElementById('tool').getAttribute('aria-busy') === 'false', null, { timeout: 30000 });
  const st = await controlState(page);
  assert(!st.result && st.href === null && st.status.startsWith('Settings changed'), 'stale result published: ' + JSON.stringify(st));
  await ctx.close();
});

await test('Start over during processing cancels cleanly', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'noisy.png'); await setTarget(page, 20); await page.check('#allow-resize');
  await startSlow(page);
  await page.click('#reset-btn');
  await page.waitForTimeout(3000);
  const st = await controlState(page);
  assert(!st.result && !st.error && st.href === null && st.live === 0, 'state after reset: ' + JSON.stringify(st));
  assert(st.status.startsWith('Cleared'), 'status overwritten: ' + st.status);
  assert(st.busy === 'false' && !st.radios.some(Boolean) && !st.resize && st.compress, 'controls wrong after reset: ' + JSON.stringify(st));
  assert(!(await page.isChecked('#allow-resize')) && (await page.$eval('input[name=target]:checked', (e) => e.value)) === '50', 'options not reset');
  await ctx.close();
});

await test('Leaving mid-run (pagehide) and returning from back/forward cache (pageshow) gives a clean, usable tool', async () => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const { page } = await openTool(ctx);
  await choose(page, 'noisy.png'); await setTarget(page, 20); await page.check('#allow-resize');
  await startSlow(page);
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await page.waitForTimeout(3000);
  const st = await controlState(page);
  assert(st.busy === 'false' && !st.radios.some(Boolean) && !st.resize && st.compress && !st.result && !st.error && st.live === 0,
    'state after restore: ' + JSON.stringify(st));
  assert(!(await visible(page, '#original')) && (await page.$eval('#file-input', (e) => e.value)) === '', 'old image still loaded');
  await page.evaluate(() => { window.__slow = 0; });
  await choose(page, 'photo.webp'); await setTarget(page, 50); await page.uncheck('#allow-resize'); await compress(page);
  const { buf } = await download(page, 'after-restore');
  assert(buf.length <= 51200 && jpegInfo(buf).width === 1600, 'tool not usable after restore');
  await ctx.close();
});

await test('Wide 12000x60 noisy PNG to 40 KB with resizing: succeeds within limits (finding 4)', async () => {
  const r = await expectSuccess('wide40', 'wide-noise.png', 40, { resize: true, sameDims: false });
  assert(Math.min(r.dec.width, r.dec.height) >= 32, 'shortest side below 32 px');
  details.wide40 = r.detail;
});

await test('Wide 12000x60 noisy PNG to 5 KB: honest "smallest allowed size" message with measured size', async () => {
  const ctx = await browser.newContext();
  const { page } = await openTool(ctx);
  await choose(page, 'wide-noise.png'); await setTarget(page, 'custom'); await page.fill('#custom-kb', '5'); await page.check('#allow-resize');
  await compress(page);
  const e = await errText(page);
  assert(e.includes('smallest size this tool allows') && e.includes('6,400 × 32 px'), 'message: ' + e);
  const bytes = Number(e.match(/\(([\d,]+) bytes\)\. Choose a larger limit/)[1].replace(/,/g, ''));
  assert(bytes > 5 * 1024, 'reported smallest size is under the limit: ' + bytes);
  // Independently measure the same candidate in Chromium.
  const measured = await page.evaluate(async () => {
    const bm = await createImageBitmap(document.getElementById('file-input').files[0]);
    const c = document.createElement('canvas'); c.width = 6400; c.height = 32;
    const x = c.getContext('2d', { alpha: false }); x.fillStyle = '#fff'; x.fillRect(0, 0, 6400, 32); x.imageSmoothingQuality = 'high'; x.drawImage(bm, 0, 0, 6400, 32);
    return new Promise((r) => c.toBlob((b) => r(b.size), 'image/jpeg', 0.1));
  });
  assert(measured === bytes, `independent measurement ${measured} != reported ${bytes}`);
  assert(!(await visible(page, '#result')) && (await page.$eval('#download', (a) => a.getAttribute('href'))) === null, 'download offered');
  const n = await page.evaluate(() => window.__encodes);
  assert(n <= 40, 'too many encodes ' + n);
  details.wide5 = `${e.replace(/\s+/g, ' ').slice(0, 230)} [independent Chromium measurement: ${measured} bytes; encodes ${n}]`;
  await ctx.close();
});

await test('Screenshots: mobile compressor before and after a successful result', async () => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(INSTRUMENT);
  await page.goto(BASE + '/compress-image-to-kb/');
  await choose(page, 'photo.jpg'); await setTarget(page, 100);
  await page.locator('section.tool').screenshot({ path: join(OUT, 'screens', 'compressor-mobile-before.png') });
  await compress(page);
  await page.locator('section.tool').screenshot({ path: join(OUT, 'screens', 'compressor-mobile-after.png') });
  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert(sw[0] <= sw[1], 'horizontal scroll at 360px');
  await ctx.close();
});

const PAGES = ['/', '/compress-image-to-kb/', '/guides/reduce-photo-size-android/', '/guides/image-dimensions-vs-file-size/', '/about/', '/contact/', '/privacy/'];

await test('Pages: status, unique titles/descriptions, one h1, canonical, internal links resolve', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const titles = new Set(), descs = new Set(), links = new Set();
  for (const p of PAGES) {
    const resp = await page.goto(BASE + p);
    assert(resp.status() === 200, p + ' status ' + resp.status());
    const info = await page.evaluate(() => ({
      title: document.title, desc: document.querySelector('meta[name=description]')?.content,
      h1: document.querySelectorAll('h1').length, canon: document.querySelector('link[rel=canonical]')?.getAttribute('href'),
      links: [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href'))
    }));
    assert(info.h1 === 1, p + ' has ' + info.h1 + ' h1');
    assert(info.desc && info.desc.length > 50 && info.desc.length <= 160, p + ' description length ' + (info.desc || '').length);
    assert(info.title.length <= 90, p + ' title too long');
    assert(info.canon === EXPECT.origin + p, `${p} canonical ${info.canon}, expected ${EXPECT.origin + p}`);
    titles.add(info.title); descs.add(info.desc); info.links.forEach((l) => links.add(l.split('#')[0]));
  }
  assert(titles.size === PAGES.length && descs.size === PAGES.length, 'titles/descriptions not unique');
  for (const l of links) { const r = await page.goto(BASE + l); assert(r.status() === 200, 'broken link ' + l); }
  const smResp = await page.goto(BASE + '/sitemap.xml');
  assert(smResp.status() === 200, 'sitemap.xml status ' + smResp.status());
  const sm = await smResp.text();
  const locs = [...sm.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => new URL(m[1]));
  assert(locs.length === PAGES.length, `sitemap has ${locs.length} URLs, expected ${PAGES.length}`);
  assert(locs.every((u) => u.origin === EXPECT.origin.toLowerCase()), 'sitemap origin is not ' + EXPECT.origin + ': ' + locs.map(String).join(' '));
  assert(JSON.stringify(locs.map((u) => u.pathname).sort()) === JSON.stringify([...PAGES].sort()), 'sitemap paths do not match pages');
  const robots = readFileSync(join(SITE, 'robots.txt'), 'utf8');
  assert(robots.includes(`Sitemap: ${EXPECT.origin}/sitemap.xml`), 'robots.txt sitemap line wrong');
  await page.goto(BASE + '/contact/');
  const contact = await page.evaluate(() => ({
    mail: document.querySelector('[data-config=email-link]').getAttribute('href'),
    text: document.querySelector('[data-config=email]').textContent,
    owner: document.querySelector('[data-config=owner-name]').textContent
  }));
  assert(contact.mail === 'mailto:' + EXPECT.email && contact.text === EXPECT.email, 'contact email wrong: ' + JSON.stringify(contact));
  assert(contact.owner === EXPECT.name, 'owner name wrong: ' + contact.owner);
  await page.goto(BASE + '/about/');
  assert((await page.textContent('[data-config=owner-name]')) === EXPECT.name, 'about owner name wrong');
  details.pages = `${PAGES.length} pages, ${links.size} unique internal links checked; origin ${EXPECT.origin}; owner "${EXPECT.name}"; email ${EXPECT.email}`;
  await ctx.close();
});

await test('404: unknown path returns 404 page with noindex and working links', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const r = await page.goto(BASE + '/no-such-page/');
  assert(r.status() === 404, 'status ' + r.status());
  assert((await page.textContent('h1')) === 'Page not found', 'wrong heading');
  assert(await page.$('meta[name=robots][content=noindex]'), 'no noindex');
  await ctx.close();
});

for (const [w, h, label] of [[360, 740, 'mobile-360'], [1280, 800, 'desktop-1280']]) {
  await test(`Layout at ${w}px: no horizontal scroll on any page${w === 360 ? ', touch targets >= 44px' : ''}`, async () => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: w === 360, hasTouch: w === 360 });
    const page = await ctx.newPage();
    for (const p of [...PAGES, '/no-such-page/']) {
      await page.goto(BASE + p);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      assert(sw[0] <= sw[1], `${p}: scrollWidth ${sw[0]} > ${sw[1]}`);
      await page.screenshot({ path: join(OUT, 'screens', `${label}${p.replace(/\//g, '_') || '_'}.png`), fullPage: true });
    }
    // Tool with a result shown
    await page.addInitScript(INSTRUMENT);
    await page.goto(BASE + '/compress-image-to-kb/');
    await choose(page, 'transparent.png'); await setTarget(page, 50); await compress(page);
    const sw = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    assert(sw[0] <= sw[1], `tool with result: scrollWidth ${sw[0]} > ${sw[1]}`);
    if (w === 360) {
      const small = await page.evaluate(() => [...document.querySelectorAll('.nav a, .button, .choice span, .file-pick, .check')]
        .filter((e) => e.offsetParent).map((e) => [e.className || e.tagName, Math.round(e.getBoundingClientRect().height)]).filter(([, hgt]) => hgt < 44));
      assert(small.length === 0, 'small touch targets: ' + JSON.stringify(small));
    }
    await page.screenshot({ path: join(OUT, 'screens', `${label}_tool-result.png`), fullPage: true });
    await ctx.close();
  });
}

await test('Keyboard: skip link first, file picker reachable by Tab with visible focus', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + '/compress-image-to-kb/');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.className === 'skip'), 'skip link not first');
  let found = false;
  for (let i = 0; i < 20 && !found; i++) { await page.keyboard.press('Tab'); found = await page.evaluate(() => document.activeElement.id === 'file-input'); }
  assert(found, 'file input not reachable by Tab');
  const outline = await page.$eval('.file-pick', (e) => getComputedStyle(e).outlineStyle);
  assert(outline !== 'none', 'no visible focus on file picker');
  await page.keyboard.press('Tab');
  assert(await page.evaluate(() => document.activeElement.name === 'target'), 'size choices not reachable');
  await page.keyboard.press('ArrowRight');
  assert(await page.evaluate(() => document.querySelector('input[name=target]:checked').value === '100'), 'arrow keys do not change size choice');
  await ctx.close();
});

await test('Without JavaScript: instructions readable, tool hidden, notice shown', async () => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/compress-image-to-kb/');
  assert(await page.isVisible('noscript .note, .note >> text=needs JavaScript'), 'noscript notice not visible');
  assert(!(await page.isVisible('#tool')), 'tool visible without JS');
  assert(await page.isVisible('text=What “KB” means here'), 'instructions not visible');
  await ctx.close();
});

// ---------- Report ----------
await browser.close(); server.close();
const lines = [];
lines.push('devMmX PhotoTools browser test report (' + MODE + ' copy)');
lines.push('Site folder: ' + SITE);
lines.push('Run at: ' + new Date().toISOString());
lines.push('Browser: Chromium ' + (await (async () => { const b = await chromium.launch(); const v = b.version(); await b.close(); return v; })()) + ' (Playwright, headless, Linux)');
lines.push('');
for (const r of results) lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.ms} ms)${r.err ? '\n      ' + r.err : ''}`);
lines.push('');
lines.push(`${results.filter((r) => r.ok).length} passed, ${results.filter((r) => !r.ok).length} failed, ${results.length} total`);
lines.push('');
lines.push('Details:');
for (const [k, v] of Object.entries(details)) lines.push(`  ${k}: ${v}`);
writeFileSync(join(OUT, 'report.txt'), lines.join('\n') + '\n');
console.log('\n' + lines.slice(-Object.keys(details).length - 3).join('\n'));
process.exit(results.every((r) => r.ok) ? 0 : 1);
