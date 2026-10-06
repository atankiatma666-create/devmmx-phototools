// Configuration regression tests for tools/config.mjs. Node.js only, no browser.
// Run: node tests/config-tests.mjs
// Each scenario works on a fresh temporary copy of an unconfigured template built from site/ and tools/.
// Works from a configured repository: the owner's site/ and site.config.json are never modified.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prepareTemplate, ownerFingerprint } from './template.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.env.RESULTS_DIR || join(REPO, 'tests', 'results');
mkdirSync(OUT, { recursive: true });
const PAGES = ['/', '/about/', '/compress-image-to-kb/', '/contact/', '/guides/image-dimensions-vs-file-size/', '/guides/reduce-photo-size-android/', '/privacy/'];
const PH = { domain: 'YOUR-DOMAIN.example', name: 'OWNER-NAME-PLACEHOLDER', email: 'CONTACT-EMAIL-PLACEHOLDER' };

const OWNER_BEFORE = ownerFingerprint(REPO);
const TEMPLATE = prepareTemplate(REPO);
const results = [];
function test(name, fn) {
  const dirs = [];
  const fresh = () => { const d = makeCopy(); dirs.push(d); return d; };
  try { fn(fresh); results.push({ name, ok: true }); console.log('PASS ' + name); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.log('FAIL ' + name + '\n     ' + e.message); }
  finally { dirs.forEach((d) => rmSync(d, { recursive: true, force: true })); }
}
function assert(c, m) { if (!c) throw new Error(m); }

function makeCopy() {
  const d = mkdtempSync(join(tmpdir(), 'phototools-cfg-'));
  cpSync(join(TEMPLATE, 'site'), join(d, 'site'), { recursive: true });
  cpSync(join(TEMPLATE, 'tools'), join(d, 'tools'), { recursive: true });
  return d;
}
function run(dir, ...args) {
  try {
    const out = execFileSync(process.execPath, [join(dir, 'tools', 'config.mjs'), ...args],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PHOTOTOOLS_REPO: dir } });
    return { code: 0, out };
  } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
}
function snapshot(dir) {
  const h = {};
  (function walk(p) {
    for (const e of readdirSync(p)) {
      const f = join(p, e);
      if (statSync(f).isDirectory()) walk(f); else h[relative(dir, f)] = createHash('sha256').update(readFileSync(f)).digest('hex');
    }
  })(join(dir, 'site'));
  const cfg = join(dir, 'site.config.json');
  h['site.config.json'] = existsSync(cfg) ? readFileSync(cfg, 'utf8') : null;
  return JSON.stringify(h);
}
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (dir, p) => readFileSync(join(dir, 'site', p), 'utf8');
const pageFile = (p) => (p === '/' ? 'index.html' : p.slice(1) + 'index.html');

// Checks every configured field in the files against the expected values.
function expectState(dir, exp) {
  const domain = exp.domain || PH.domain, name = exp.name || PH.name, email = exp.email || PH.email;
  const origin = 'https://' + domain;
  for (const p of PAGES) {
    const html = read(dir, pageFile(p));
    const m = html.match(/<link rel="canonical" href="([^"]*)" data-config="canonical">/g) || [];
    assert(m.length === 1, `${p}: ${m.length} canonical links`);
    assert(m[0].includes(`href="${origin}${p}"`), `${p}: canonical is ${m[0]}, expected ${origin}${p}`);
  }
  const locs = [...read(dir, 'sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map((x) => x[1]);
  assert(JSON.stringify(locs) === JSON.stringify(PAGES.map((p) => origin + p)), 'sitemap locs wrong: ' + locs.join(' '));
  assert(read(dir, 'robots.txt').includes(`Sitemap: ${origin}/sitemap.xml\n`), 'robots.txt sitemap line wrong');
  for (const f of ['about/index.html', 'contact/index.html']) {
    const owners = [...read(dir, f).matchAll(/<span data-config="owner-name">([^<]*)<\/span>/g)].map((x) => x[1]);
    assert(owners.length >= 1 && owners.every((o) => o === esc(name)), `${f}: owner text ${JSON.stringify(owners)} != ${esc(name)}`);
  }
  for (const f of ['contact/index.html', 'privacy/index.html']) {
    const h = read(dir, f);
    assert(h.includes(`href="mailto:${esc(email)}" data-config="email-link"`), `${f}: mailto link not ${email}`);
    assert(h.includes(`<span data-config="email">${esc(email)}</span>`), `${f}: email text not ${email}`);
  }
  const st = run(dir, 'status');
  assert(st.code === 0, 'status failed: ' + st.out);
  const complete = exp.domain && exp.name && exp.email;
  const pp = run(dir, 'prepublish');
  assert(complete ? pp.code === 0 : pp.code === 1, `prepublish exit ${pp.code} but setup is ${complete ? 'complete' : 'incomplete'}: ${pp.out}`);
}
const noTrace = (dir, ...values) => {
  for (const f of Object.keys(JSON.parse(snapshot(dir)))) {
    if (f === 'site.config.json') continue;
    const txt = readFileSync(join(dir, f), 'utf8');
    for (const v of values) assert(!txt.includes(v), `${f} still contains old value ${v}`);
  }
};

const A = { domain: 'first.example.com', name: 'Owner One', email: 'first@example.com' };
const B = { domain: 'second.example.org', name: 'Owner Two', email: 'second@example.org' };
const setArgs = (o) => Object.entries(o).flatMap(([k, v]) => ['--' + k, v]);

test('Template copy: status consistent but incomplete, prepublish fails', (fresh) => {
  const d = fresh();
  expectState(d, {});
  assert(run(d, 'status').out.includes('setup incomplete'), 'status does not say incomplete');
});

test('All fields supplied together', (fresh) => {
  const d = fresh();
  const r = run(d, 'set', ...setArgs(A));
  assert(r.code === 0, r.out);
  expectState(d, A);
  assert(JSON.parse(readFileSync(join(d, 'site.config.json'), 'utf8')).domain === A.domain, 'config not saved');
});

test('Domain first, then name and email (no corrupted email)', (fresh) => {
  const d = fresh();
  assert(run(d, 'set', '--domain', A.domain).code === 0, 'set domain failed');
  expectState(d, { domain: A.domain });
  assert(run(d, 'set', '--name', A.name, '--email', A.email).code === 0, 'set name/email failed');
  expectState(d, A);
  noTrace(d, 'CONTACT-EMAIL');
});

test('Name and email first, then domain', (fresh) => {
  const d = fresh();
  assert(run(d, 'set', '--name', A.name).code === 0, 'set name failed');
  expectState(d, { name: A.name });
  assert(run(d, 'set', '--email', A.email).code === 0, 'set email failed');
  expectState(d, { name: A.name, email: A.email });
  assert(run(d, 'set', '--domain', A.domain).code === 0, 'set domain failed');
  expectState(d, A);
});

test('Changing all three fields replaces every old value', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(A));
  const r = run(d, 'set', ...setArgs(B));
  assert(r.code === 0 && /\b9 site file\(s\) updated/.test(r.out), 'expected 9 files updated (7 pages, sitemap, robots): ' + r.out);
  expectState(d, B);
  noTrace(d, A.domain, A.name, A.email);
});

test('Changing one field at a time after full setup', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(A));
  run(d, 'set', '--email', B.email); expectState(d, { ...A, email: B.email });
  run(d, 'set', '--name', B.name); expectState(d, { ...A, email: B.email, name: B.name });
  run(d, 'set', '--domain', B.domain); expectState(d, B);
  noTrace(d, A.domain, A.name, A.email);
});

test('pages.dev hostname, then a custom domain', (fresh) => {
  const d = fresh();
  run(d, 'set', '--domain', 'devmmx-phototools.pages.dev', '--name', A.name, '--email', A.email);
  expectState(d, { ...A, domain: 'devmmx-phototools.pages.dev' });
  run(d, 'set', '--domain', 'https://Photos.Example.com/');   // normalised to photos.example.com
  expectState(d, { ...A, domain: 'photos.example.com' });
  noTrace(d, 'pages.dev');
});

test('Running unchanged settings twice changes nothing', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(A));
  const before = snapshot(d);
  const r1 = run(d, 'set', ...setArgs(A));
  const r2 = run(d, 'apply');
  assert(r1.out.includes('0 site file(s) updated.') && r2.out.includes('0 site file(s) updated.'), 'reported changes: ' + r1.out + r2.out);
  assert(snapshot(d) === before, 'files changed on unchanged re-run');
});

test('Reapplying saved settings after unpacking an updated ZIP', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(B));
  // Simulate the Set up site workflow: old site/ removed, new template copied in, config kept.
  rmSync(join(d, 'site'), { recursive: true });
  cpSync(join(TEMPLATE, 'site'), join(d, 'site'), { recursive: true });
  const st = run(d, 'status');
  assert(st.code === 1 && st.out.includes('do not match'), 'status should report stale files: ' + st.out);
  assert(run(d, 'prepublish').code === 1, 'prepublish passed on stale files');
  assert(run(d, 'apply').code === 0, 'apply failed');
  expectState(d, B);
});

test('Invalid inputs leave all files unchanged', (fresh) => {
  const bad = [
    ['--domain', 'https://x.example.com/path'], ['--domain', 'localhost'], ['--domain', 'a..b.com'],
    ['--domain', 'YOUR-DOMAIN.example'], ['--domain', 'bad_char.com'], ['--domain', 'site.com:8080'],
    ['--email', 'no-at-sign'], ['--email', 'a@b'], ['--email', 'a b@example.com'], ['--email', '<x>@example.com'],
    ['--name', 'Bell\u0007'], ['--name', 'x'.repeat(101)], ['--name', 'OWNER-NAME-PLACEHOLDER'],
    ['--colour', 'blue']
  ];
  for (const configured of [false, true]) {
    const d = fresh();
    if (configured) run(d, 'set', ...setArgs(A));
    for (const [flag, value] of bad) {
      const before = snapshot(d);
      // A valid field alongside the invalid one must not be applied either.
      const other = flag === '--name' ? ['--domain', 'valid.example.net'] : ['--name', 'Valid Name'];
      const r = run(d, 'set', flag, value, ...other);
      assert(r.code === 1 && r.out.includes('Nothing was changed'), `accepted ${flag} ${JSON.stringify(value)}: ${r.out}`);
      assert(snapshot(d) === before, `files changed after rejected ${flag} ${JSON.stringify(value)}`);
    }
    expectState(d, configured ? A : {});
  }
});

test('Values are escaped and inserted literally ($&, quotes, angle brackets)', (fresh) => {
  const d = fresh();
  const name = 'Tom & "Jerry" <b>$& $1 $$ $\' O\'Neil';
  const email = 'first.last+tag_1@sub.example.co.uk';
  const r = run(d, 'set', '--domain', 'xn--bcher-kva.example', '--name', name, '--email', email);
  assert(r.code === 0, r.out);
  expectState(d, { domain: 'xn--bcher-kva.example', name, email });
  assert(read(d, 'about/index.html').includes('Tom &amp; &quot;Jerry&quot; &lt;b&gt;$&amp; $1 $$ $&#39; O&#39;Neil'), 'name not escaped literally');
  const before = snapshot(d);
  run(d, 'apply');
  assert(snapshot(d) === before, 'escaped values not stable on re-apply');
});

test('Hand-edited or missing fields are detected', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(A));
  const f = join(d, 'site', 'privacy', 'index.html');
  const orig = readFileSync(f, 'utf8');
  writeFileSync(f, orig.replace('https://first.example.com/privacy/', 'https://wrong.example.com/privacy/'));
  assert(run(d, 'status').code === 1, 'status missed edited canonical');
  assert(run(d, 'prepublish').code === 1, 'prepublish missed edited canonical');
  run(d, 'apply'); expectState(d, A);
  writeFileSync(f, orig.replace(/ data-config="canonical"/, ''));
  const before = snapshot(d);
  const r = run(d, 'set', '--name', 'Another');
  assert(r.code === 1 && r.out.includes('config markers'), 'missing marker not reported: ' + r.out);
  assert(snapshot(d) === before, 'files changed despite missing marker');
});

test('Broken site.config.json is reported and nothing changes', (fresh) => {
  const d = fresh();
  writeFileSync(join(d, 'site.config.json'), '{ "domain": ');
  const before = snapshot(d);
  const r = run(d, 'apply');
  assert(r.code === 1 && r.out.includes('not valid JSON'), r.out);
  writeFileSync(join(d, 'site.config.json'), JSON.stringify({ domain: 'bad domain' }));
  assert(run(d, 'apply').code === 1, 'invalid saved domain accepted');
  assert(snapshot(d).replace(/"site.config.json":".*"/, '') === before.replace(/"site.config.json":".*"/, ''), 'site files changed');
});

// ---------- Per-page marker regressions ----------
const MARKERS = {
  owner: /<span data-config="owner-name">[^<]*<\/span>/,
  email: /<span data-config="email">[^<]*<\/span>/,
  emailLink: /<a [^>]*data-config="email-link">.*?<\/a>/
};
const LABEL = { owner: 'owner-name', email: 'email', emailLink: 'email-link' };
const REQUIRED = [
  ['about/index.html', 'owner'], ['contact/index.html', 'owner'],
  ['contact/index.html', 'email'], ['contact/index.html', 'emailLink'],
  ['privacy/index.html', 'email'], ['privacy/index.html', 'emailLink']
];
// Every structural problem must fail status and prepublish, and block set/apply before any write.
function expectStructuralFailure(d, file, label, why) {
  const st = run(d, 'status'); const pp = run(d, 'prepublish');
  assert(st.code === 1 && st.out.includes(file) && st.out.includes(`"${label}"`), `${why}: status did not report ${file} "${label}": ${st.out}`);
  assert(pp.code === 1 && pp.out.includes(file) && pp.out.includes(`"${label}"`), `${why}: prepublish did not report it: ${pp.out}`);
  const before = snapshot(d);
  const a = run(d, 'apply'); const s2 = run(d, 'set', '--name', 'Someone Else');
  assert(a.code === 1 && s2.code === 1 && a.out.includes('config markers') && s2.out.includes('Nothing was changed'), `${why}: apply/set not refused: ${a.out} ${s2.out}`);
  assert(snapshot(d) === before, `${why}: files changed after refused apply/set`);
}

test('Exact reproduction: owner marker on Contact replaced by plain text is caught', (fresh) => {
  const d = fresh();
  run(d, 'set', '--domain', 'myphoto.example.com', '--name', 'Sem', '--email', 'sem@example.com');
  const f = join(d, 'site', 'contact', 'index.html');
  writeFileSync(f, readFileSync(f, 'utf8').replace('<span data-config="owner-name">Sem</span>', '<span>Old Owner</span>'));
  expectStructuralFailure(d, 'contact/index.html', 'owner-name', 'reproduction');
});

for (const [file, kind] of REQUIRED) {
  test(`Removing ${LABEL[kind]} marker on ${file} fails status, prepublish, set and apply`, (fresh) => {
    const d = fresh();
    run(d, 'set', ...setArgs(A));
    const f = join(d, 'site', file);
    const html = readFileSync(f, 'utf8');
    const m = html.match(MARKERS[kind]);
    assert(m, 'marker not found to remove');
    // Keep the visible text, drop only the marker
    writeFileSync(f, html.replace(m[0], m[0].replace(/ data-config="[a-z-]+"/, '')));
    expectStructuralFailure(d, file, LABEL[kind], 'removed');
  });
  test(`Duplicating ${LABEL[kind]} marker on ${file} fails status, prepublish, set and apply`, (fresh) => {
    const d = fresh();
    run(d, 'set', ...setArgs(A));
    const f = join(d, 'site', file);
    const html = readFileSync(f, 'utf8');
    const m = html.match(MARKERS[kind]);
    writeFileSync(f, html.replace(m[0], m[0] + ' ' + m[0]));
    expectStructuralFailure(d, file, LABEL[kind], 'duplicated');
  });
}

test('Malformed marker (extra attribute) and marker on an unexpected page are caught', (fresh) => {
  const d = fresh();
  run(d, 'set', ...setArgs(A));
  const f = join(d, 'site', 'privacy', 'index.html');
  const orig = readFileSync(f, 'utf8');
  writeFileSync(f, orig.replace('<span data-config="email">', '<span class="x" data-config="email">'));
  expectStructuralFailure(d, 'privacy/index.html', 'email', 'malformed');
  writeFileSync(f, orig);
  assert(run(d, 'prepublish').code === 0, 'restored file should pass');
  const g = join(d, 'site', 'index.html');
  writeFileSync(g, readFileSync(g, 'utf8').replace('</main>', '<span data-config="owner-name">x</span></main>'));
  expectStructuralFailure(d, 'index.html', 'owner-name', 'unexpected page');
});

test('Template is built correctly from a repository configured with real-looking values, which stays unchanged', () => {
  const repo = mkdtempSync(join(tmpdir(), 'phototools-ownerrepo-'));
  let tpl;
  try {
    cpSync(join(TEMPLATE, 'site'), join(repo, 'site'), { recursive: true });
    cpSync(join(TEMPLATE, 'tools'), join(repo, 'tools'), { recursive: true });
    assert(run(repo, 'set', '--domain', 'myphoto.example.com', '--name', 'Sem', '--email', 'sem@example.com').code === 0, 'configure failed');
    const before = ownerFingerprint(repo);
    tpl = prepareTemplate(repo);
    assert(ownerFingerprint(repo) === before, 'owner repository changed by template preparation');
    assert(!existsSync(join(tpl, 'site.config.json')), 'template has saved settings');
    expectState(tpl, {});
    for (const f of Object.keys(JSON.parse(snapshot(tpl)))) {
      if (f === 'site.config.json') continue;
      const t = readFileSync(join(tpl, f), 'utf8');
      assert(!t.includes('myphoto.example.com') && !t.includes('sem@example.com') && !/>Sem</.test(t), `${f} still has the owner's values`);
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
    if (tpl) rmSync(tpl, { recursive: true, force: true });
  }
});

rmSync(TEMPLATE, { recursive: true, force: true });
test("Owner's working site/ and site.config.json are unchanged after all configuration tests", () => {
  assert(ownerFingerprint(REPO) === OWNER_BEFORE, "the owner's site files or site.config.json changed during testing");
});

const pass = results.filter((r) => r.ok).length;
const lines = ['devMmX PhotoTools configuration tests', 'Run at: ' + new Date().toISOString(), 'Node.js ' + process.version, ''];
for (const r of results) lines.push(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.err ? '\n      ' + r.err : ''}`);
lines.push('', `${pass} passed, ${results.length - pass} failed, ${results.length} total`);
writeFileSync(join(OUT, 'config-report.txt'), lines.join('\n') + '\n');
console.log(`\n${pass} passed, ${results.length - pass} failed, ${results.length} total`);
process.exit(pass === results.length ? 0 : 1);
