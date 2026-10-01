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

test('mixed controller can request cancellation during actual building', async () => {
  const state = harness({ phase: 'building index: loading tuples' });
  const onActivity = jest.fn(async activity => activity?.phase.startsWith('building index'));
  expect(await executeStudyImageWorker({ ...state, task: {}, phase: 'cancelled_build', onActivity }))
    .toMatchObject({ interrupted: true, signal: 'SIGTERM' });
  expect(onActivity).toHaveBeenCalledWith({ phase: 'building index: loading tuples' });
  expect(state.runtime.signal).toHaveBeenCalledTimes(1);
});

test('controller failure stops the child and checks independent database cleanup', async () => {
  const state = harness({ phase: 'building index: loading tuples' });
  await expect(executeStudyImageWorker({ ...state, task: {}, phase: 'mixed_build',
    onActivity: async () => { throw new Error('foreground_failed'); } })).rejects.toThrow('foreground_failed');
  expect(state.runtime.signal).toHaveBeenCalledWith('SIGKILL');
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
