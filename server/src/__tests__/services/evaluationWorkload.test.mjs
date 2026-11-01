/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test,expect,jest,afterEach } from '@jest/globals';
import { validateEvaluationWorkload,projectEvaluationWorkload } from '../../services/evaluationWorkloadContract.mjs';
import { createEvaluationWorkloadGuard } from '../../services/evaluationWorkloadGuard.mjs';
import { INVENTORY_BACKGROUND_READINESS_SQL } from '../../services/inventoryBackgroundReadiness.mjs';

const configuration = () => ({ revision: 0,mode: 'when_idle',dailyRequests: 5,startMinute: null,endMinute: null });
afterEach(() => jest.useRealTimers());
test('explicit bounded opt-in and windows reject unknown keys, types and equal endpoints', () => {
  expect(validateEvaluationWorkload(configuration())).toEqual(configuration());
  for (const delta of [{ revision: -1 },{ revision: 2147483647 },{ mode: 'always' },{ dailyRequests: '5' },
    { dailyRequests: 201 },{ dailyRequests: 0 },{ mode: 'off' },{ secret: 'PRIVATE' },
    { startMinute: 1 },{ mode: 'scheduled' },{ mode: 'scheduled',startMinute: 0,endMinute: 0 },
    { mode: 'scheduled',startMinute: -1,endMinute: 600 },{ mode: 'scheduled',startMinute: 120,endMinute: 1440 }]) {
    expect(() => validateEvaluationWorkload({ ...configuration(),...delta })).toThrow('evaluation_workload_invalid');
  }
  for (const value of [null,[],true,'{}']) expect(() => validateEvaluationWorkload(value)).toThrow('invalid');
  expect(validateEvaluationWorkload({ ...configuration(),mode: 'off',dailyRequests: 0 }).mode).toBe('off');
  expect(validateEvaluationWorkload({ ...configuration(),mode: 'scheduled',startMinute: 1380,endMinute: 120 }).mode).toBe('scheduled');
});

test('callback completion aborts a pending monitor read before draining it', async () => {
  jest.useFakeTimers();
  const state = { daily_calls: 5,revision: 1,window_open: true };
  let complete, release, options, reads = 0;
  const callback = new Promise(resolve => { complete = resolve; });
  const blocked = new Promise(resolve => { release = resolve; });
  const database = { withTransaction: async (fn, readOptions) => {
    if (++reads === 3) { options = readOptions; return blocked; }
    return fn({ query: async sql => ({ rows: [sql === INVENTORY_BACKGROUND_READINESS_SQL ? { readiness: 'ready' } : state] }) });
  } };
  const guard = createEvaluationWorkloadGuard(database);
  const execution = guard(() => callback, { revision: 1, signal: new AbortController().signal });
  await jest.advanceTimersByTimeAsync(0); await jest.advanceTimersByTimeAsync(2000);
  complete('completed'); await jest.advanceTimersByTimeAsync(0);
  try { expect(options?.signal.aborted).toBe(true); }
  finally { release(state); expect(await execution).toBe('completed'); }
});
test('legacy tighter token ceilings remain visible as request limits without private state', () => {
  expect(projectEvaluationWorkload()).toMatchObject({ mode: 'off',dailyRequests: 0,scope: 'installation',timezone: 'UTC' });
  const result = projectEvaluationWorkload({ ...configuration(),daily_calls: 100,daily_tokens: 16896,
    workload_mode: 'when_idle',progress: 'PRIVATE',published_fingerprint: 'PRIVATE' });
  expect(result.dailyRequests).toBe(2); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
test.each(['off','revision','window','foreground','database'])('guard refuses %s before provider work', async kind => {
  const state = { daily_calls: 5,revision: 1,window_open: true };
  if (kind === 'off') state.daily_calls = 0;
  if (kind === 'revision') state.revision = 2;
  if (kind === 'window') state.window_open = false;
  const database = { withTransaction: async fn => {
    if (kind === 'database') throw new Error('PRIVATE');
    return fn({ query: async sql => ({ rows: [sql === INVENTORY_BACKGROUND_READINESS_SQL ? { readiness: kind === 'foreground' ? 'backfilling' : 'ready' } : state] }) });
  } };
  const guard = createEvaluationWorkloadGuard(database);
  const capture = jest.fn();
  await expect(guard(capture,{ revision: 1,signal: new AbortController().signal })).rejects.toThrow('evaluation_workload_deferred');
  expect(capture).not.toHaveBeenCalled();
});
