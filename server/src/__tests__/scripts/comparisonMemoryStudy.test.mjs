/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { withPrivateStudyLock } from '../../scripts/comparisonMemoryStudy/fixture.mjs';

test.each([['natural'], ['collect'], ['collect', '--unexpected'], ['unknown']])(
  'synthetic memory study refuses execution without explicit isolation flag (%#)', async (...args) => {
    const run = promisify(execFile);
    await expect(run(process.execPath, [fileURLToPath(new URL('../../scripts/comparisonMemoryStudy/run.mjs', import.meta.url)), ...args], {
      env: { ...process.env, CLASSIFARR_SYNTHETIC_MEMORY_STUDY: '0' }, timeout: 10000, maxBuffer: 16384,
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('comparison_memory_isolated_only') });
  });

test.each(['acquire_failure', 'busy', 'callback_failure', 'unlock_failure', 'complete'])(
  'private study lock always returns its client (%s)', async scenario => {
    const failure = new Error('synthetic_database_failure');
    const client = { release: jest.fn(), query: jest.fn(async sql => {
      if (sql.includes('pg_try_advisory_lock')) {
        if (scenario === 'acquire_failure') throw failure;
        return { rows: [{ locked: scenario !== 'busy' }] };
      }
      if (scenario === 'unlock_failure') throw failure;
      return { rows: [] };
    }) };
    const pool = { connect: jest.fn(async () => client) };
    const callback = jest.fn(async () => { if (scenario === 'callback_failure') throw failure; });
    const result = withPrivateStudyLock(pool, 123, callback);
    if (scenario.endsWith('_failure')) await expect(result).rejects.toBe(failure);
    else await expect(result).resolves.toBe(scenario === 'complete');
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(['acquire_failure', 'busy'].includes(scenario) ? 0 : 1);
    expect(client.query).toHaveBeenCalledWith('SELECT pg_try_advisory_lock($1) AS locked', [123]);
    expect(client.query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_unlock'))).toHaveLength(
      ['acquire_failure', 'busy'].includes(scenario) ? 0 : 1);
  });
