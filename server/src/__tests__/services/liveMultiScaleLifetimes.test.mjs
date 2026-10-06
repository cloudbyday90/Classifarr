/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('comparison releases read and fit inputs before subsequent phases, including cache hits', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['--expose-gc',
    fileURLToPath(new URL('../helpers/liveMultiScaleLifetimeProbe.mjs', import.meta.url))], {
    timeout: 10000, maxBuffer: 32768, env: { ...process.env, NODE_OPTIONS: '' },
  });
  expect(stdout).toContain('comparison_phase_lifetimes_passed');
});
