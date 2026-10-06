// Generates synthetic test images in tests/fixtures/. Uses only Playwright's Chromium.
// Run: node tests/generate-fixtures.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = new URL('./fixtures/', import.meta.url).pathname;
mkdirSync(DIR, { recursive: true });

function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function pngHeaderOnly(w, h, idat) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))
  ]);
}

const browser = await chromium.launch();
const page = await browser.newPage();

async function draw(name, w, h, kind, type, quality) {
  const b64 = await page.evaluate(({ w, h, kind, type, quality }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // Deterministic pseudo-random generator so fixtures are reproducible
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    if (kind === 'photo') {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#5b8fd1'); g.addColorStop(0.5, '#e9d9a6'); g.addColorStop(1, '#3d6b3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `hsla(${rnd() * 360},60%,${30 + rnd() * 50}%,0.6)`;
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 5 + rnd() * w / 15, 0, 7); ctx.fill();
      }
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 40; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      ctx.putImageData(img, 0, 0);
      ctx.fillStyle = '#111'; ctx.font = `${Math.round(h / 12)}px sans-serif`; ctx.fillText('PhotoTools fixture', w * 0.05, h * 0.9);
    } else if (kind === 'noise') {
      const img = ctx.createImageData(w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { d[i] = rnd() * 255; d[i + 1] = rnd() * 255; d[i + 2] = rnd() * 255; d[i + 3] = 255; }
      ctx.putImageData(img, 0, 0);
    } else if (kind === 'transparent') {
      // Left half fully transparent; right half detailed red/blue pattern
      for (let y = 0; y < h; y += 10) for (let x = w / 2; x < w; x += 10) {
        ctx.fillStyle = ((x + y) / 10) % 2 ? '#c0392b' : '#2c3e9b'; ctx.fillRect(x, y, 10, 10);
      }
    } else if (kind === 'detailed') {
      // Photo-like texture with several sizes of text, like a phone photo of a document or ID card
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#c9d6c2'); g.addColorStop(1, '#8a9bb0');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) {
        ctx.strokeStyle = `hsla(${rnd() * 360},45%,${25 + rnd() * 50}%,0.5)`; ctx.lineWidth = 1 + rnd() * 3;
        ctx.beginPath(); const x = rnd() * w, y = rnd() * h; ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 300, y + (rnd() - 0.5) * 300); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.fillRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
      ctx.fillStyle = '#1a1a1a';
      let y = h * 0.08 + 90;
      for (const size of [72, 48, 36, 28, 22, 18]) {
        ctx.font = `${size}px sans-serif`;
        for (let line = 0; line < 3; line++) {
          ctx.fillText(`Size ${size}px: The quick brown fox jumps over the lazy dog 0123456789`, w * 0.1, y);
          y += size * 1.5;
        }
        y += 30;
      }
      const img = ctx.getImageData(0, 0, w, h), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 24; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
      ctx.putImageData(img, 0, 0);
    } else if (kind === 'small') {
      ctx.fillStyle = '#7aa'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#245'; ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    }
    return c.toDataURL(type, quality).split(',')[1];
  }, { w, h, kind, type, quality });
  const buf = Buffer.from(b64, 'base64');
  writeFileSync(join(DIR, name), buf);
  return buf;
}

const photo = await draw('photo.jpg', 3000, 2000, 'photo', 'image/jpeg', 0.95);
await draw('photo.webp', 1600, 1200, 'photo', 'image/webp', 0.95);
await draw('noisy.png', 2000, 1500, 'noise', 'image/png');
// Detailed 4000 x 3000 photo of text (Stage 2A)
await draw('detailed.jpg', 4000, 3000, 'detailed', 'image/jpeg', 0.92);
// Very wide strip (finding 4): 12000 x 60 random noise
await draw('wide-noise.png', 12000, 60, 'noise', 'image/png');
// Strip already at the smallest allowed size (shortest side 30 px <= 32): cannot be made smaller (Stage 2A.1)
await draw('strip-noise.png', 3000, 30, 'noise', 'image/png');
await draw('transparent.png', 800, 600, 'transparent', 'image/png');
await draw('small.jpg', 300, 200, 'small', 'image/jpeg', 0.8);
// A real PNG with the wrong extension (should still be accepted: format is detected from the bytes)
writeFileSync(join(DIR, 'png-named-as.jpg'), readFileSync(join(DIR, 'transparent.png')));

// JPEG with an EXIF block containing fake GPS text, inserted after SOI
const exifPayload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), Buffer.from('MM\0*\0\0\0\x08 FAKE-GPS-48.8584N-2.2945E ', 'binary')]);
const app1 = Buffer.concat([Buffer.from([0xFF, 0xE1]), Buffer.from([(exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xFF]), exifPayload]);
writeFileSync(join(DIR, 'exif.jpg'), Buffer.concat([photo.subarray(0, 2), app1, photo.subarray(2)]));

// Broken and unsupported inputs
let seed = 99; const rb = (n) => Buffer.from(Array.from({ length: n }, () => (seed = (seed * 69069 + 1) >>> 0) >>> 24));
writeFileSync(join(DIR, 'random-bytes.jpg'), rb(50000));
writeFileSync(join(DIR, 'jpeg-garbage.jpg'), Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), rb(40000)]));
writeFileSync(join(DIR, 'truncated.jpg'), photo.subarray(0, Math.floor(photo.length * 0.6)));
writeFileSync(join(DIR, 'text-renamed.png'), Buffer.from('This is a text file, not an image.\n'.repeat(20)));
writeFileSync(join(DIR, 'huge-dimensions.png'), pngHeaderOnly(20000, 20000, Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])));
writeFileSync(join(DIR, 'bad-data.png'), pngHeaderOnly(400, 300, rb(3000)));
writeFileSync(join(DIR, 'animation.gif'), Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
writeFileSync(join(DIR, 'photo.heic'), Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), rb(2000)]));
writeFileSync(join(DIR, 'empty.jpg'), Buffer.alloc(0));
// 26 MB file with a JPEG signature: must be rejected by the size check before decoding
const big = Buffer.alloc(26 * 1024 * 1024); big[0] = 0xFF; big[1] = 0xD8; big[2] = 0xFF;
writeFileSync(join(DIR, 'oversized.jpg'), big);

await browser.close();
console.log('Fixtures written to ' + DIR);
