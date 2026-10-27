// Typechecks every edge function with Deno using the shared import map.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const functionsDir = join(root, 'supabase', 'functions');
const importMap = join(functionsDir, 'import_map.json');

const candidates = [process.env.DENO_BIN, join(homedir(), 'tools', 'deno', 'deno.exe'), 'deno'].filter(Boolean);
let deno = null;
for (const c of candidates) {
  try {
    execFileSync(c, ['--version'], { stdio: 'ignore' });
    deno = c;
    break;
  } catch {
    // try the next candidate
  }
}
if (!deno) {
  console.error('deno not found. Install Deno or set DENO_BIN.');
  process.exit(1);
}

const entries = readdirSync(functionsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => join(functionsDir, d.name, 'index.ts'))
  .filter((p) => existsSync(p));

let failed = 0;
for (const entry of entries) {
  try {
    execFileSync(deno, ['check', '--import-map', importMap, '--no-lock', '--node-modules-dir=none', entry], { stdio: 'inherit' });
    console.log(`ok   ${entry}`);
  } catch {
    failed += 1;
    console.error(`FAIL ${entry}`);
  }
}
console.log(`${entries.length - failed}/${entries.length} functions typecheck`);
process.exit(failed ? 1 : 0);
