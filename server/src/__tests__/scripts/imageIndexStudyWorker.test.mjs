/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { executeStudyImageWorker, awaitStudyIndexIdle } from '../../scripts/imageIndexStudyWorker.mjs';

function harness({ phase, sampleFailure = false } = {}) {
  let exited = false, resolve;
  const runtime = { done: new Promise(done => { resolve = done; }), hasExited: () => exited,
    signal: jest.fn(signal => { exited = true; resolve({ code: null, signal }); }) };
  const query = jest.fn().mockResolvedValue({ rows: phase ? [{ phase }] : [] });
  const sampler = { sample: jest.fn(async () => {
    if (sampleFailure) throw new Error('sample_failed');
    if (!phase) { exited = true; resolve({ code: 0, signal: null }); }
    query.mockResolvedValue({ rows: [] });
  }) };
  const start = jest.fn(() => runtime);
  return { runtime, query, sampler, start };
}

test('worker completes and independently checks database idle', async () => {
  const state = harness();
  const result = await executeStudyImageWorker({ ...state, task: {}, phase: 'small_build' });
  expect(result).toMatchObject({ exitCode: 0, signal: null, watchdog: false, interrupted: false });
  expect(state.query.mock.calls.length).toBeGreaterThanOrEqual(3);
  expect(state.runtime.signal).not.toHaveBeenCalled();
});
test('interruption only happens after an observed writer-wait phase', async () => {
  const state = harness({ phase: 'waiting for writers before build' });
  expect(await executeStudyImageWorker({ ...state, task: {}, phase: 'interruption', interrupt: true }))
    .toMatchObject({ interrupted: true, signal: 'SIGTERM' });
  expect(state.runtime.signal).toHaveBeenCalledTimes(1);
});
test('telemetry failure kills and joins the live child before propagating', async () => {
  const state = harness({ sampleFailure: true });
  await expect(executeStudyImageWorker({ ...state, task: {}, phase: 'small_build' })).rejects.toThrow('sample_failed');
  expect(state.runtime.signal).toHaveBeenCalledWith('SIGKILL');
  expect(state.runtime.hasExited()).toBe(true);
});
test('idle observation tolerates delayed PostgreSQL cancellation', async () => {
  const query = jest.fn().mockResolvedValueOnce({ rows: [{}] }).mockResolvedValue({ rows: [] });
  await awaitStudyIndexIdle(query); expect(query).toHaveBeenCalledTimes(2);
});
