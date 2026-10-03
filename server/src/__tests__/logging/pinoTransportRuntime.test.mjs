/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL('../fixtures/pinoTransportFixture.mjs', import.meta.url));
let directory;
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = null;
});

function records(text) {
  return text.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

function assertRecords(text, levels) {
  const parsed = records(text);
  expect(parsed.map(record => record.level)).toEqual(levels);
  expect(text).not.toContain('synthetic-password');
  expect(text).not.toContain('synthetic-token');
  for (const record of parsed) {
    expect(record).toMatchObject({
      module: 'RuntimeSmoke', 'quoted"binding': 'synthetic',
      password: '[REDACTED]', token: '[REDACTED]',
    });
    expect(Object.hasOwn(record, '__proto__')).toBe(true);
    expect(record.__proto__).toBeNull();
  }
}

test.each(['files', 'stdout'])('real %s worker preserves JSON, redaction and target filtering', async mode => {
  directory = await mkdtemp(join(tmpdir(), 'classifarr-pino-'));
  const { stdout, stderr } = await execute(process.execPath, [fixture, mode, directory], {
    cwd: directory, timeout: 10000, maxBuffer: 256 * 1024, windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'production' },
  });
  expect(stderr).toBe('');
  assertRecords(stdout, mode === 'files' ? [20, 30, 40, 50] : [40, 50]);
  const files = await readdir(directory);
  if (mode === 'stdout') {
    expect(files).toEqual([]);
    return;
  }
  for (const [prefix, levels] of [['classifarr', [20, 30, 40, 50]], ['error', [40, 50]]]) {
    const matches = files.filter(name => name.startsWith(`${prefix}.`));
    expect(matches).toHaveLength(1);
    assertRecords(await readFile(join(directory, matches[0]), 'utf8'), levels);
  }
}, 15000);
