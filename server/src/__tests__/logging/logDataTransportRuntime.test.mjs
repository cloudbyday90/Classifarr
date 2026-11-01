/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const fixture = fileURLToPath(new URL('../fixtures/logDataTransportFixture.mjs', import.meta.url));
let directory;
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = null; });

function assertRecords(text, levels) {
  const lines = text.trim().split('\n');
  const records = lines.map(line => JSON.parse(line));
  expect(records.map(record => record.level)).toEqual(levels.flatMap(level => [level, level]));
  expect(text).not.toContain('PRIVATE');
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    expect(record.module).toBe('ProjectionRuntime');
    expect(record.token).toBe('[REDACTED]');
    expect(record.time).toMatch(/^202\d-/);
    if (index % 2 === 0) {
      expect(record.msg).toMatch(/^Ordinary /);
      expect(Object.hasOwn(record, '__proto__')).toBe(true);
      expect(record.__proto__).toBeNull();
      expect(record.constructor).toBe('ordinary');
      expect(record.password).toBe('[REDACTED]');
    } else {
      expect(record.msg).toMatch(/^Bounded /);
      expect(record.logDataStatus).toBe('root_fields');
      expect(record.logData.safe).toBe('retained');
      expect(record.logData.password).toBe('[REDACTED]');
      expect(record.logData.cycle).toBe('[LogData:cycle]');
      expect(record.logData.error).toBe('[LogData:accessor]');
      expect(Buffer.byteLength(JSON.stringify({ logData: record.logData, logDataStatus: record.logDataStatus }))).toBeLessThanOrEqual(65536);
    }
    // Pino must not emit a second reserved root field before the real one.
    expect((lines[index].match(/"level":/g) || []).length).toBe(index % 2 === 0 ? 1 : 2);
  }
}

test.each(['files', 'stdout'])('real shim %s workers preserve identity, redaction and bounded data', async mode => {
  directory = await mkdtemp(join(tmpdir(), 'classifarr-log-data-'));
  const { stdout, stderr } = await execute(process.execPath, [fixture, mode, directory], {
    cwd: directory, timeout: 10000, maxBuffer: 1024 * 1024, windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot, NODE_ENV: 'production' },
  });
  expect(stderr).toBe('');
  assertRecords(stdout, mode === 'files' ? [20, 30, 40, 50] : [40, 50]);
  const files = await readdir(directory);
  if (mode === 'stdout') { expect(files).toEqual([]); return; }
  for (const [prefix, levels] of [['classifarr', [20, 30, 40, 50]], ['error', [40, 50]]]) {
    const matches = files.filter(name => name.startsWith(`${prefix}.`));
    expect(matches).toHaveLength(1);
    assertRecords(await readFile(join(directory, matches[0]), 'utf8'), levels);
  }
}, 15000);
