/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test.each(['plain', 'callbacks', 'retained-control', 'study-consumers'])('snapshot lifetime boundary: %s', async mode => {
  const result = await promisify(execFile)(process.execPath, ['--expose-gc',
    fileURLToPath(new URL('../helpers/representativeSnapshotLifetime.mjs', import.meta.url)), mode],
  { timeout: 20000, maxBuffer: 16384, windowsHide: true, env: { ...process.env, NODE_OPTIONS: '' } });
  expect(result.stdout.trim()).toBe('representative_snapshot_lifetime_passed');
  expect(result.stderr).toBe('');
}, 25000);
