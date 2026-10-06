#!/usr/bin/env node
// devMmX PhotoTools — site configuration (domain, owner name, contact email).
//
// Values are saved in site.config.json (repository root, not published) and rendered
// into marked fields in site/. Rendering always starts from the markers, never from
// earlier values, so it can be repeated, run in any order, and changed later.
//
//   node tools/config.mjs set --domain photo.example.com --name "Your Name" --email you@example.com
//        Any subset of the three. Blank values are ignored. Validates first; on any
//        error nothing is changed. Then renders all saved values into site/.
//   node tools/config.mjs apply       Re-render saved values (use after unpacking a new version).
//   node tools/config.mjs status      Show what is set. Exit 1 only if files do not match the saved values.
//   node tools/config.mjs prepublish  Exit 1 unless all three values are set, every field matches,
//                                     and no placeholder text remains. Used as the Cloudflare build command.
//
// Works on Node.js 18+. No dependencies.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = process.env.PHOTOTOOLS_REPO || fileURLToPath(new URL('..', import.meta.url));
const SITE = join(REPO, 'site');
const CONFIG = join(REPO, 'site.config.json');

export const PLACEHOLDER = {
  domain: 'YOUR-DOMAIN.example',
  name: 'OWNER-NAME-PLACEHOLDER',
  email: 'CONTACT-EMAIL-PLACEHOLDER'
};
const FIELDS = ['domain', 'name', 'email'];

// ---------- Validation ----------
export function normalizeDomain(raw) {
  let d = String(raw).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!d) return { error: 'domain is empty' };
  if (d.length > 253) return { error: 'domain is too long' };
  if (/[\/:?#@\s]/.test(d)) return { error: 'domain must be a host name only, like photo.example.com (no path, port or spaces)' };
  const labels = d.split('.');
  if (labels.length < 2) return { error: 'domain needs at least one dot, like photo.example.com' };
  for (const l of labels) {
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l)) return { error: `domain part "${l}" is not valid` };
  }
  if (!/^([a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels[labels.length - 1])) return { error: 'domain must end with a real top-level domain such as .com or .dev' };
  if (d === PLACEHOLDER.domain.toLowerCase()) return { error: 'domain is still the placeholder' };
  return { value: d };
}
export function normalizeName(raw) {
  const n = String(raw).trim().replace(/\s+/g, ' ');
  if (!n) return { error: 'name is empty' };
  if (n.length > 100) return { error: 'name is longer than 100 characters' };
  if (/[\u0000-\u001f\u007f]/.test(n)) return { error: 'name contains control characters' };
  if (n === PLACEHOLDER.name) return { error: 'name is still the placeholder' };
  return { value: n };
}
export function normalizeEmail(raw) {
  const e = String(raw).trim();
  if (!e) return { error: 'email is empty' };
  if (e.length > 254) return { error: 'email is too long' };
  const at = e.lastIndexOf('@');
  if (at < 1 || !/^[A-Za-z0-9._%+-]+$/.test(e.slice(0, at)) || e.slice(0, at).length > 64) return { error: 'email is not valid' };
  const host = normalizeDomain(e.slice(at + 1));
  if (host.error) return { error: 'email domain is not valid' };
  return { value: e.slice(0, at) + '@' + host.value };
}
const NORMALIZE = { domain: normalizeDomain, name: normalizeName, email: normalizeEmail };

// ---------- Escaping (values are always inserted literally, never as patterns) ----------
const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escXml = escHtml;

// ---------- Rendering ----------
const RE = {
  canonical: /<link rel="canonical" href="([^"]*)" data-config="canonical">/g,
  owner: /<span data-config="owner-name">[^<]*<\/span>/g,
  email: /<span data-config="email">[^<]*<\/span>/g,
  emailLink: /href="mailto:[^"]*" data-config="email-link"/g
};

// Where each marked field must appear, and how many times. Any other page must have none.
// Checked per page, so a marker on one page can never hide a missing one on another.
export const REQUIRED_MARKERS = {
  'about/index.html': { owner: 1 },
  'contact/index.html': { owner: 1, email: 1, emailLink: 1 },
  'privacy/index.html': { email: 1, emailLink: 1 }
};
const MARKER_LABEL = { owner: 'owner-name', email: 'email', emailLink: 'email-link' };
const RAW = {   // every occurrence of the attribute, well-formed or not
  owner: /data-config="owner-name"/g,
  email: /data-config="email"/g,
  emailLink: /data-config="email-link"/g,
  canonical: /data-config="canonical"/g
};
const countOf = (re, text) => (text.match(re) || []).length;

function htmlFiles(dir, out = []) {
  for (const e of readdirSync(dir).sort()) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) htmlFiles(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

function pathOf(href) {
  const m = /^https?:\/\/[^/]+(\/.*)$/.exec(href);
  return m ? m[1] : null;
}

function originFor(cfg) { return 'https://' + (cfg.domain || PLACEHOLDER.domain); }

// Returns { files: Map(path -> newContent), problems: [], paths: [] } without writing.
export function render(cfg) {
  const origin = originFor(cfg);
  const name = cfg.name || PLACEHOLDER.name;
  const email = cfg.email || PLACEHOLDER.email;
  const files = new Map();
  const problems = [];
  const paths = [];
  const seen = new Set();
  for (const f of htmlFiles(SITE)) {
    const rel = relative(SITE, f).split('\\').join('/');
    seen.add(rel);
    const src = readFileSync(f, 'utf8');
    const counts = { owner: 0, email: 0, emailLink: 0 };
    let canon = 0;
    let out = src.replace(RE.canonical, (whole, href) => {
      canon++;
      const p = pathOf(href);
      if (!p) { problems.push(`${rel}: canonical link has an unexpected address "${href}"`); return whole; }
      paths.push(p);
      return `<link rel="canonical" href="${escHtml(origin + p)}" data-config="canonical">`;
    });
    out = out.replace(RE.owner, () => { counts.owner++; return `<span data-config="owner-name">${escHtml(name)}</span>`; });
    out = out.replace(RE.email, () => { counts.email++; return `<span data-config="email">${escHtml(email)}</span>`; });
    out = out.replace(RE.emailLink, () => { counts.emailLink++; return `href="mailto:${escHtml(email)}" data-config="email-link"`; });
    // Per-page marker check: exact counts where required, none elsewhere, none malformed.
    const want = REQUIRED_MARKERS[rel] || {};
    for (const k of Object.keys(MARKER_LABEL)) {
      const expected = want[k] || 0;
      if (counts[k] !== expected) {
        problems.push(`${rel}: expected ${expected} "${MARKER_LABEL[k]}" marker${expected === 1 ? '' : 's'}, found ${counts[k]}` +
          (counts[k] < expected ? ' (missing)' : ' (duplicate or unexpected)'));
      }
      const raw = countOf(RAW[k], src);
      if (raw !== counts[k]) problems.push(`${rel}: ${raw - counts[k]} "${MARKER_LABEL[k]}" marker(s) not in the expected form`);
    }
    if (countOf(RAW.canonical, src) !== canon) problems.push(`${rel}: a "canonical" marker is not in the expected form`);
    const isNotFound = rel === '404.html';
    if (!isNotFound && canon !== 1) problems.push(`${rel}: expected 1 canonical marker, found ${canon}`);
    if (isNotFound && canon !== 0) problems.push(`404.html must not have a canonical link`);
    files.set(f, out);
  }
  for (const rel of Object.keys(REQUIRED_MARKERS)) if (!seen.has(rel)) problems.push(`${rel}: page is missing`);
  paths.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<!-- Generated by tools/config.mjs from the canonical links. Do not edit by hand. -->\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    paths.map((p) => `  <url><loc>${escXml(origin + p)}</loc></url>\n`).join('') + '</urlset>\n';
  files.set(join(SITE, 'sitemap.xml'), sitemap);
  files.set(join(SITE, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
  return { files, problems, paths, origin };
}

// ---------- Saved config ----------
export function loadConfig() {
  if (!existsSync(CONFIG)) return {};
  let raw;
  try { raw = JSON.parse(readFileSync(CONFIG, 'utf8')); } catch (e) { throw new Error('site.config.json is not valid JSON: ' + e.message); }
  const cfg = {};
  for (const k of FIELDS) {
    if (raw[k] === undefined || raw[k] === null || raw[k] === '') continue;
    const r = NORMALIZE[k](raw[k]);
    if (r.error) throw new Error(`site.config.json: ${r.error}`);
    cfg[k] = r.value;
  }
  return cfg;
}

function diffFiles(files) {
  const changed = [];
  for (const [f, content] of files) {
    const cur = existsSync(f) ? readFileSync(f, 'utf8') : null;
    if (cur !== content) changed.push(f);
  }
  return changed;
}

function writeAll(files, changed) {
  for (const f of changed) writeFileSync(f, files.get(f));
}

function describe(cfg) {
  return FIELDS.map((k) => `  ${k.padEnd(6)} ${cfg[k] ? cfg[k] : '(not set)'}`).join('\n');
}

function strayPlaceholders() {
  const hits = [];
  (function walk(dir) {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.(html|xml|txt)$/.test(p)) continue;
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        for (const t of Object.values(PLACEHOLDER)) if (line.includes(t)) hits.push(`${relative(SITE, p)}:${i + 1} contains ${t}`);
      });
    }
  })(SITE);
  return hits;
}

// ---------- CLI ----------
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) args[a.slice(2, eq)] = a.slice(eq + 1);
    else { args[a.slice(2)] = argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[++i] : ''; }
  }
  return args;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const fail = (m) => { console.error('ERROR: ' + m); console.error('Nothing was changed.'); process.exit(1); };
  let cfg;
  try { cfg = loadConfig(); } catch (e) { fail(e.message); }

  if (cmd === 'set' || cmd === 'apply') {
    const next = { ...cfg };
    if (cmd === 'set') {
      const unknown = Object.keys(args).filter((k) => !FIELDS.includes(k));
      if (unknown.length) fail('unknown option(s): ' + unknown.map((k) => '--' + k).join(', ') + '. Use --domain, --name, --email.');
      const errors = [];
      for (const k of FIELDS) {
        if (args[k] === undefined || String(args[k]).trim() === '') continue;
        const r = NORMALIZE[k](args[k]);
        if (r.error) errors.push(r.error); else next[k] = r.value;
      }
      if (errors.length) fail(errors.join('; '));
    }
    const { files, problems } = render(next);
    if (problems.length) fail('the site files have missing, duplicate or malformed config markers:\n  ' + problems.join('\n  '));
    const changed = diffFiles(files);
    writeAll(files, changed);
    const cfgChanged = JSON.stringify(next) !== JSON.stringify(cfg);
    if (cfgChanged) writeFileSync(CONFIG, JSON.stringify(next, null, 2) + '\n');
    console.log('Saved settings:\n' + describe(next));
    console.log(`${changed.length} site file(s) updated${cfgChanged ? ', site.config.json updated' : ''}.`);
    for (const f of changed) console.log('  ' + relative(REPO, f));
    const missing = FIELDS.filter((k) => !next[k]);
    console.log(missing.length ? `Setup incomplete: ${missing.join(', ')} not set yet. Not ready to publish.` : 'All settings present. Run "node tools/config.mjs prepublish" to confirm.');
    return;
  }

  if (cmd === 'status' || cmd === 'prepublish') {
    const { files, problems, paths, origin } = render(cfg);
    const stale = diffFiles(files);
    console.log('Saved settings:\n' + describe(cfg));
    console.log(`Origin used for canonical links and sitemap: ${origin} (${paths.length} pages)`);
    const errors = problems.length ? ['the site files have missing, duplicate or malformed config markers:\n    ' + problems.join('\n    ')] : [];
    if (stale.length) errors.push('these files do not match the saved settings (run "node tools/config.mjs apply"):\n    ' + stale.map((f) => relative(REPO, f)).join('\n    '));
    const missing = FIELDS.filter((k) => !cfg[k]);
    if (cmd === 'prepublish') {
      if (missing.length) errors.push('not set: ' + missing.join(', '));
      const stray = strayPlaceholders();
      if (stray.length) errors.push('placeholder text remains:\n    ' + stray.join('\n    '));
      if (errors.length) { console.error('NOT READY TO PUBLISH:\n  - ' + errors.join('\n  - ')); process.exit(1); }
      console.log('Ready to publish: all settings are set and every page matches them.');
      return;
    }
    if (errors.length) { console.error('INCONSISTENT:\n  - ' + errors.join('\n  - ')); process.exit(1); }
    console.log(missing.length ? `Consistent, but setup incomplete: ${missing.join(', ')} not set. Not ready to publish.` : 'Consistent and complete.');
    return;
  }

  console.log('Usage: node tools/config.mjs <set|apply|status|prepublish> [--domain D] [--name N] [--email E]');
  process.exit(cmd ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
