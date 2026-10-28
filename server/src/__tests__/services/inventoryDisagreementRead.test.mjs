/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';
import { disagreementInputs } from '../fixtures/inventoryDisagreementFixture.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function runtimeFixture() {
  const input = disagreementInputs(), queries = [], close = jest.fn();
  const runtime = { close, withTransaction: jest.fn(async (callback, options) => {
    expect(options).toMatchObject({ readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    return callback({ query: async (sql, values) => {
      queries.push({ sql, values });
      if (sql.includes('transaction_timestamp')) return { rows: [{ observed_at: new Date(input.observedAt) }] };
      if (sql.includes('AS recorded_movie_tv_events')) return { rows: [input.activity] };
      if (sql.includes('AS payload_bytes')) return { rows: [{ input: input.rows[0], captures: 1, payload_bytes: '2000' }] };
      return { rows: [] };
    } });
  }) };
  return { runtime, queries, input };
}
test('explicit mode admits one database-clock window, returns only its projection and always closes', async () => {
  const { runtime, queries } = runtimeFixture();
  const listeners = process.listenerCount('SIGINT');
  const report = await runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements'], load: async () => runtime });
  expect(report).toMatchObject({ private: true, display: { flaggedCases: 1 } });
  expect(queries.at(-1).values).toEqual(['2026-09-28T18:00:00.000Z', '2026-10-28T18:00:00.000Z', 67108864]);
  expect(queries.map(row => row.sql).join(' ')).not.toMatch(/INSERT|UPDATE|DELETE|library_policies/);
  expect(runtime.close).toHaveBeenCalledTimes(1); expect(process.listenerCount('SIGINT')).toBe(listeners);
});
test.each([['--prospective'], ['--gap-audit-status'], ['--since', '2026-10-01'], ['--seed', 'test'], ['--size', '50']])
('rejects conflicting options %j before loading runtime', async (...options) => {
  const load = jest.fn();
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements', ...options], load })).rejects.toThrow('mode_options');
  expect(load).not.toHaveBeenCalled();
});
test('abort and reader failure return no report and clean listeners/runtime', async () => {
  const { runtime } = runtimeFixture(), controller = new AbortController(); controller.abort();
  const listeners = process.listenerCount('SIGTERM');
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements'], signal: controller.signal, load: async () => runtime }))
    .rejects.toMatchObject({ name: 'AbortError' });
  expect(runtime.withTransaction).not.toHaveBeenCalled(); expect(runtime.close).toHaveBeenCalledTimes(1);
  runtime.withTransaction.mockRejectedValueOnce(new Error('synthetic reader failure'));
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements'], load: async () => runtime })).rejects.toThrow('synthetic reader failure');
  expect(runtime.close).toHaveBeenCalledTimes(2); expect(process.listenerCount('SIGTERM')).toBe(listeners);
});
test('source admission failure cannot return a partial report', async () => {
  const { runtime } = runtimeFixture();
  runtime.withTransaction.mockImplementation(callback => callback({ query: async sql => ({ rows: sql.includes('transaction_timestamp')
    ? [{ observed_at: new Date('2026-10-28T18:00:00Z') }] : sql.includes('AS payload_bytes')
      ? [{ input: null, captures: 5001, payload_bytes: '0' }] : [] }) }));
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-disagreements'], load: async () => runtime })).rejects.toThrow('input_budget');
  expect(runtime.close).toHaveBeenCalledTimes(1);
});
test('real CLI failure prints a fixed error without arguments, private content or a partial report', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/runInventoryOutcomeCalibration.mjs', import.meta.url)),
    '--prospective-disagreements', '--seed', 'PRIVATE_SENTINEL'], { encoding: 'utf8', timeout: 10000,
    env: { ...process.env, LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' } });
  expect(result.status).toBe(1); expect(result.stdout).toBe('');
  expect(result.stderr).toContain('inventory_outcome_calibration_failed'); expect(result.stderr).not.toContain('PRIVATE_SENTINEL');
});
