/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test.each([['natural'], ['collect'], ['collect', '--unexpected'], ['unknown']])(
  'synthetic memory study refuses execution without explicit isolation flag (%#)', async (...args) => {
    const run = promisify(execFile);
    await expect(run(process.execPath, [fileURLToPath(new URL('../../scripts/comparisonMemoryStudy/run.mjs', import.meta.url)), ...args], {
      env: { ...process.env, CLASSIFARR_SYNTHETIC_MEMORY_STUDY: '0' }, timeout: 10000, maxBuffer: 16384,
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('comparison_memory_isolated_only') });
  });
