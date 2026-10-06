// Runs every test:
//   1. Configuration tests (Node.js only)
//   2. Browser tests on a TEMPLATE copy: built in a temp folder by resetting every marked field to its
//      placeholder (tests/template.mjs), even if this repository is already configured
//   3. Browser tests on a CONFIGURED copy: that template plus test settings, prepublish must pass
//   4. A check that the owner's site/ and site.config.json were not changed
// Safe to run in a configured repository.
// Run: node tests/generate-fixtures.mjs && node tests/run-all.mjs
// Results: tests/results/config-report.txt, tests/results/template/, tests/results/configured/
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { prepareTemplate, ownerFingerprint } from './template.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const RESULTS = join(REPO, 'tests', 'results');
rmSync(RESULTS, { recursive: true, force: true });
mkdirSync(RESULTS, { recursive: true });
const node = (args, env = {}) => spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, ...env }, cwd: REPO }).status;

const ownerBefore = ownerFingerprint(REPO);
const summary = [];
console.log('\n=== 1. Configuration tests ===');
summary.push(['Configuration tests', node([join(REPO, 'tests', 'config-tests.mjs')], { RESULTS_DIR: RESULTS })]);

const tmp = mkdtempSync(join(tmpdir(), 'phototools-copies-'));
let template;
try {
  console.log('\n=== 2. Browser tests: template copy ===');
  template = prepareTemplate(REPO);
  const tpl = join(tmp, 'template');
  cpSync(join(template, 'site'), join(tpl, 'site'), { recursive: true });
  summary.push(['Browser tests, template copy', node([join(REPO, 'tests', 'run-tests.mjs')], { SITE_DIR: join(tpl, 'site'), RESULTS_DIR: join(RESULTS, 'template') })]);

  console.log('\n=== 3. Browser tests: configured copy ===');
  const cfg = join(tmp, 'configured');
  cpSync(join(template, 'site'), join(cfg, 'site'), { recursive: true });
  cpSync(join(template, 'tools'), join(cfg, 'tools'), { recursive: true });
  const set = node([join(cfg, 'tools', 'config.mjs'), 'set', '--domain', 'phototools-test.example.com', '--name', 'Test Owner & Co', '--email', 'owner@phototools-test.example.com'], { PHOTOTOOLS_REPO: cfg });
  const pre = node([join(cfg, 'tools', 'config.mjs'), 'prepublish'], { PHOTOTOOLS_REPO: cfg });
  summary.push(['Configured copy: config set + prepublish', set || pre]);
  summary.push(['Browser tests, configured copy', node([join(REPO, 'tests', 'run-tests.mjs')], { SITE_DIR: join(cfg, 'site'), RESULTS_DIR: join(RESULTS, 'configured') })]);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  if (template) rmSync(template, { recursive: true, force: true });
}
const ownerSame = ownerFingerprint(REPO) === ownerBefore;
summary.push(["Owner's site/ and site.config.json unchanged by testing", ownerSame ? 0 : 1]);

console.log('\n=== Summary ===');
for (const [name, code] of summary) console.log(`${code === 0 ? 'PASS' : 'FAIL'}  ${name}`);
for (const f of ['config-report.txt', 'template/report.txt', 'configured/report.txt']) {
  try { const t = readFileSync(join(RESULTS, f), 'utf8'); console.log(`  ${f}: ${t.match(/\d+ passed, \d+ failed, \d+ total/)[0]}`); } catch { console.log(`  ${f}: missing`); }
}
process.exit(summary.every(([, c]) => c === 0) ? 0 : 1);
