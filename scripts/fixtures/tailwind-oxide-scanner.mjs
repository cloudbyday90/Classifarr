/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(new URL('../../client/package.json', import.meta.url));
const mode = process.argv[2];
assert.ok(['native', 'wasi'].includes(mode));
if (mode === 'wasi') assert.equal(process.platform, 'linux');
process.env.NAPI_RS_FORCE_WASI = mode === 'wasi' ? 'error' : 'false';
const { Scanner } = require('@tailwindcss/oxide');
const wasiPath = require.resolve('@tailwindcss/oxide-wasm32-wasi');
assert.equal(Boolean(require.cache[wasiPath]), mode === 'wasi', 'exercise the requested actual binding');

const parent = join(root, '.tmp');
mkdirSync(parent, { recursive: true });
const directory = mkdtempSync(join(parent, 'tailwind-scanner-'));
assert.equal(dirname(resolve(directory)), resolve(parent));
const recognized = new Set(['flex', 'grid', 'underline']);
let result;
try {
  const source = join(directory, 'source.html');
  writeFileSync(source, '<div class="flex"></div>');
  const scanner = new Scanner({ sources: [{ base: directory, pattern: '**/*.html', negated: false }] });
  const scan = () => ({
    candidates: scanner.scan().filter(candidate => recognized.has(candidate)).sort(),
    files: scanner.files.map(file => relative(directory, file).replaceAll('\\', '/')).sort(),
    scannedFiles: scanner.scannedFiles.map(file => relative(directory, file).replaceAll('\\', '/')).sort(),
  });
  const initial = scan();
  const unchanged = scan();
  writeFileSync(source, readFileSync(source, 'utf8').replace('flex', 'grid'));
  const changedAt = statSync(source).mtime;
  utimesSync(source, changedAt, new Date(changedAt.getTime() + 2000));
  const changed = scan();
  mkdirSync(join(directory, 'nested'));
  writeFileSync(join(directory, 'nested', 'added.html'), '<div class="underline"></div>');
  const added = scan();
  result = { mode, initial, unchanged, changed, added };
} finally {
  // Freshly minted fixture only; no caller-selected path or application data.
  rmSync(directory, { recursive: true, force: true });
}
console.log(JSON.stringify(result));
// WASI owns an idle worker pool; all synchronous scans and fixture cleanup have
// completed. Explicit child exit is also used by upstream's integration control.
process.exit(0);
