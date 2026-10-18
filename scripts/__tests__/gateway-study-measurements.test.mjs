/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudyMeasurements, requireStudyCoverage } from '../fixtures/ollamaGatewayRehearsal/studyMeasurements.mjs';
import { createStudyResourceSample, studyCpu, studyIo } from '../fixtures/ollamaGatewayRehearsal/studyResource.mjs';
import { createStudyDatabaseSample } from '../fixtures/ollamaGatewayRehearsal/studyDatabase.mjs';
import * as parsers from '../../server/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';

test('minute bins keep first/last/range and separate idle; raw untrusted fields are omitted', async () => {
  let clock = 0, value = 10, phase = 'archives';
  const measurements = createStudyMeasurements(async () => ({ currentBytes: value, anonBytes: 1, fileBytes: 9, secret: 'not evidence' }),
    { now: () => clock, phase: () => phase });
  for (let index = 0; index < 60; index++) { clock = index * 1000; value++; await measurements.tick(); }
  phase = 'idle';
  for (let index = 60; index < 120; index++) { clock = index * 1000; await measurements.tick(); }
  const result = requireStudyCoverage(measurements.summary(), 118000, true);
  assert.equal(result.samples, 120); assert.equal(result.bins.length, 2);
  assert.deepEqual(result.bins[0].values.currentBytes, { first: 11, last: 70, min: 11, max: 70, count: 60 });
  assert.ok(!JSON.stringify(result).includes('secret')); assert.equal(result.coverage.pressureSomeUs, undefined);
});

test('missing, invalid, capped and gapped evidence cannot pass coverage', async () => {
  let clock = 0;
  const empty = createStudyMeasurements(async () => ({}), { now: () => clock });
  assert.throws(() => requireStudyCoverage(empty.summary(), 0));
  for (const sample of [{}, { currentBytes: NaN }, { currentBytes: -1 }]) {
    const measure = createStudyMeasurements(async () => sample, { now: () => clock }); await measure.tick();
    assert.throws(() => requireStudyCoverage(measure.summary(), 0));
  }
  const measure = createStudyMeasurements(async () => ({ currentBytes: 1, anonBytes: 1, fileBytes: 0 }), { now: () => clock });
  await measure.tick(); clock = 6000; await measure.tick(); assert.throws(() => requireStudyCoverage(measure.summary(), 0));
  clock = 0; const capped = createStudyMeasurements(async () => ({}), { now: () => clock });
  for (let index = 0; index < 2049; index++) { clock = index * 1000; await capped.tick(); }
  assert.equal(capped.summary().samples, 2048); assert.equal(capped.summary().capReached, true);
});

test('an in-flight sample cannot overlap and stop waits for it', async () => {
  let release, calls = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const measurements = createStudyMeasurements(async () => { calls++; await pending; return {}; });
  const first = measurements.tick(); await measurements.tick(); assert.equal(calls, 1);
  let stopped = false; const stop = measurements.stop().then(() => { stopped = true; });
  await Promise.resolve(); assert.equal(stopped, false); release(); await first; await stop; assert.equal(stopped, true);
});

test('v1/v2 CPU and I/O counters are not mixed or double-counted', () => {
  assert.deepEqual(studyCpu('usage_usec 123\nthrottled_usec 4', 2), { cpuUsageUs: 123, cpuThrottledUs: 4 });
  assert.deepEqual(studyCpu('nr_periods 10\nthrottled_time 4000', 1), { cpuThrottledUs: 4 });
  assert.deepEqual(studyIo('8:0 Read 12\n8:0 Write 34\n8:0 Total 46\nTotal 46', 1), { readBytes: 12, writeBytes: 34 });
  assert.deepEqual(studyIo('8:0 rbytes=12 wbytes=34 rios=1 wios=2', 2), { readBytes: 12, writeBytes: 34 });
  for (const value of ['garbage', '8:0 Read -1']) assert.throws(() => studyIo(value, 1));
  assert.throws(() => studyIo('8:0 rbytes=-1', 2)); assert.throws(() => studyCpu('usage_usec nope', 2));
});

test('missing optional kernel metrics remain absent, while mandatory memory is normalized', async () => {
  const read = async path => {
    if (path.endsWith('/memory.stat')) return 'total_rss 10\ntotal_cache 20';
    if (path.endsWith('/memory.usage_in_bytes')) return '30'; throw new Error('unavailable');
  };
  const sample = await createStudyResourceSample({ version: 1, read, parsers })();
  assert.deepEqual(sample, { currentBytes: 30, anonBytes: 10, fileBytes: 20 });
  assert.equal(sample.pressureSomeUs, undefined); assert.equal(sample.readBytes, undefined);
});

test('transaction observation records bounded metadata only, without query text', async () => {
  let current = [{ identity: 'pid:start', age: 12 }]; const sql = [];
  const sample = createStudyDatabaseSample({ query: async text => { sql.push(text); return { rows: current }; } });
  assert.deepEqual(await sample(), { observedTransactions: 1, maxTransactionAgeMs: 12 });
  current = []; assert.deepEqual(await sample(), { observedTransactions: 1, maxTransactionAgeMs: 0 });
  assert.ok(sql.every(text => !/SELECT\s+query\b/.test(text)));
});
