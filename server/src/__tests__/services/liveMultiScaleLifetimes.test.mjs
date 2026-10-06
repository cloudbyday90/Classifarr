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

test('streaming verification releases completed vector batches before the next query', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['--expose-gc',
    fileURLToPath(new URL('../helpers/comparisonVerificationLifetimeProbe.mjs', import.meta.url))], {
    timeout: 10000, maxBuffer: 32768, env: { ...process.env, NODE_OPTIONS: '' },
  });
  expect(stdout).toContain('comparison_verification_batches_released');
});

test('the full-map control demonstrates why verification batches remained reachable', async () => {
  await expect(promisify(execFile)(process.execPath, ['--expose-gc',
    fileURLToPath(new URL('../helpers/comparisonVerificationLifetimeProbe.mjs', import.meta.url)), '--full-map-control'], {
    timeout: 10000, maxBuffer: 32768, env: { ...process.env, NODE_OPTIONS: '' },
  })).rejects.toMatchObject({ stderr: expect.stringContaining('completed_batch_vectors_retained') });
});
