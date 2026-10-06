/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { withPrivateStudyLock } from '../../scripts/comparisonMemoryStudy/fixture.mjs';
import { createComparisonStudyTiming } from '../../scripts/comparisonMemoryStudy/timing.mjs';
import { createComparisonStudyPhases } from '../../scripts/comparisonMemoryStudy/phases.mjs';
import { measureVectorCopies } from '../../scripts/comparisonMemoryStudy/copies.mjs';
import { prepareInventoryDescriptionCorpus } from '../../services/inventoryDescriptionCorpus.mjs';

test.each([['natural'], ['elapsed'], ['collect'], ['copies'], ['collect', '--unexpected'], ['unknown']])(
  'synthetic memory study refuses execution without explicit isolation flag (%#)', async (...args) => {
    const run = promisify(execFile);
    await expect(run(process.execPath, [fileURLToPath(new URL('../../scripts/comparisonMemoryStudy/run.mjs', import.meta.url)), ...args], {
      env: { ...process.env, CLASSIFARR_SYNTHETIC_MEMORY_STUDY: '0' }, timeout: 10000, maxBuffer: 16384,
    })).rejects.toMatchObject({ code: 1, stderr: expect.stringContaining('comparison_memory_isolated_only') });
  });

test('fast study advances only its injected clock and does not sleep', async () => {
  const wait = jest.fn(), timing = createComparisonStudyTiming({ wait });
  expect(timing.now()).toBe(1_000_000);
  await timing.beforeCycle(0); await timing.beforeCycle(1);
  expect(timing.now()).toBe(1_600_002); expect(wait).not.toHaveBeenCalled();
});

test('elapsed study uses the real clock and verifies monotonic time across short waits', async () => {
  let elapsed = 0, wall = 100;
  const wait = jest.fn(async ms => { elapsed += ms / 2; if (ms < 1) elapsed++; });
  const timing = createComparisonStudyTiming({ elapsed: true, wait, monotonic: () => elapsed, wallClock: () => wall });
  await timing.beforeCycle(0); expect(wait).not.toHaveBeenCalled();
  expect(timing.now()).toBe(100); wall = 200; expect(timing.now()).toBe(200);
  await timing.beforeCycle(1);
  expect(elapsed).toBeGreaterThanOrEqual(300_001);
  expect(wait.mock.calls.every(([ms]) => ms > 0 && ms <= 30_000)).toBe(true);
  const previous = elapsed; await timing.beforeCycle(2);
  expect(elapsed - previous).toBeGreaterThanOrEqual(300_001);
});

test('phase observer passes inputs/results through unchanged and tracks only weak-reference candidates', async () => {
  const events = [], metrics = { mark: async name => { events.push(name); }, track: jest.fn() };
  const input = {}, options = {}, model = {}, vector = [1, 0], rows = [{ vector }];
  const result = { libraries: [], media: new Map([['movie', { rows }], ['tv', { rows: [] }]]) };
  const fit = jest.fn(async () => model), discover = jest.fn(async () => result);
  const observer = createComparisonStudyPhases(metrics, 'cycle_0', { fit, discover });
  expect(await observer.fit(input, 2, options)).toBe(model);
  expect(fit).toHaveBeenCalledWith(input, 2, options);
  expect(await observer.discover(input, options)).toBe(result);
  expect(discover).toHaveBeenCalledWith(input, options);
  expect(events).toEqual(['cycle_0_worker_fit', 'cycle_0_control', 'cycle_0_community', 'cycle_0_quality']);
  expect(metrics.track).toHaveBeenCalledWith('communityRows', rows);
  expect(metrics.track).toHaveBeenCalledWith('communityVector', vector);
  expect(metrics.track).toHaveBeenCalledTimes(3);
});

test.each(['fit', 'discover'])('phase observer propagates %s failure without inventing completion', async method => {
  const failure = new Error('synthetic_failure'), events = [];
  const metrics = { mark: async name => { events.push(name); }, track: jest.fn() };
  const observer = createComparisonStudyPhases(metrics, 'cycle_1', { [method]: async () => { throw failure; } });
  await expect(observer[method]()).rejects.toBe(failure);
  expect(events).toHaveLength(1); expect(metrics.track).not.toHaveBeenCalled();
});

test('copy control uses independent valid copies without changing the source', async () => {
  const corpus = prepareInventoryDescriptionCorpus([{ media_type: 'movie', tmdb_id: 1, library_id: 1, overview: 'Synthetic copy control' }]);
  const snapshot = { libraries: [{ id: 1, media_type: 'movie' }], corpus,
    vectors: new Map([[corpus.documents[0].hash, [3, 4]]]) };
  const before = structuredClone(snapshot);
  const read = jest.fn(async () => snapshot), phases = [], mark = jest.fn();
  const identity = { provider: 'ollama', model: 'study:latest', digest: 'a'.repeat(64), dimensions: 2 };
  await measureVectorCopies({ fixture: { identity, repository: { read } },
    metrics: { settled: async name => { phases.push(name); }, mark } });
  expect(snapshot).toEqual(before);
  expect(read).toHaveBeenCalledWith(identity, { requireCompleteVectors: true });
  expect(phases).toEqual(['copies_snapshot', 'copies_owned', 'copies_clone', 'copies_normalized', 'copies_duplicate']);
  expect(mark).toHaveBeenCalledWith('copies_retained', { vectorCounts: [1, 1, 1, 1, 1], dimensions: 2 });
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
