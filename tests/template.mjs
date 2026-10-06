// Shared test helper: builds a genuinely unconfigured copy of the site in a temporary folder.
// The owner's working site/ and site.config.json are only read, never modified.
import { cpSync, mkdtempSync, readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('..', import.meta.url));

// Copies site/ and tools/ (but not site.config.json) into a new temp folder, then runs
// "config.mjs apply" there with no saved settings, which resets every marked field to its
// placeholder and regenerates sitemap.xml and robots.txt. Fails if the result is not a clean template.
export function prepareTemplate(sourceRepo = REPO) {
  const d = mkdtempSync(join(tmpdir(), 'phototools-template-'));
  cpSync(join(sourceRepo, 'site'), join(d, 'site'), { recursive: true });
  cpSync(join(sourceRepo, 'tools'), join(d, 'tools'), { recursive: true });
  const node = (args) => execFileSync(process.execPath, [join(d, 'tools', 'config.mjs'), ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PHOTOTOOLS_REPO: d }
  });
  node(['apply']);
  const status = node(['status']);
  if (!status.includes('setup incomplete: domain, name, email not set')) throw new Error('template reset failed:\n' + status);
  return d;
}

// Fingerprint of the owner's working files, to prove tests did not touch them.
export function ownerFingerprint(repo = REPO) {
  const h = createHash('sha256');
  (function walk(p) {
    for (const e of readdirSync(p).sort()) {
      const f = join(p, e);
      if (statSync(f).isDirectory()) walk(f);
      else h.update(relative(repo, f) + '\0').update(readFileSync(f));
    }
  })(join(repo, 'site'));
  const cfg = join(repo, 'site.config.json');
  h.update('site.config.json\0').update(existsSync(cfg) ? readFileSync(cfg) : 'absent');
  return h.digest('hex');
}
