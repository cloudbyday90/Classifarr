/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { verifySystemZlibImage } from './lib/systemZlibCompatibility.mjs';

const directory = resolve(import.meta.dirname, '../.tmp/ci');
const path = resolve(directory, 'system-zlib.json');
try {
  rmSync(path, { force: true });
  const source = process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', timeout: 5000 }).trim();
  const receipt = await verifySystemZlibImage(process.env.IMAGE_NAME || 'classifarr:test', source);
  mkdirSync(directory, { recursive: true });
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  process.stdout.write('System zlib native, PostgreSQL and curl controls passed.\n');
} catch {
  process.stderr.write('System zlib image verification failed; no qualification receipt was produced.\n');
  process.exitCode = 1;
}
