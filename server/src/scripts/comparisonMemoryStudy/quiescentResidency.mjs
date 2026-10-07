/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { assertComparisonMappings } from './mappingContract.mjs';

export const QUIESCENT_RESIDENCY_MS = 120000;
const NUMBERS = ['elapsedMs', 'rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers', 'containerBytes',
  'createdWorkers', 'exitedWorkers', 'activeWorkers', 'mainHeapPhysicalBytes', 'mainV8MallocBytes'];

export function assertQuiescentResidency(value) {
  assert.deepEqual(Object.keys(value ?? {}).sort(), ['durationMs', 'samples', 'version']);
  assert.equal(value.version, 1); assert.ok(Number.isSafeInteger(value.durationMs));
  assert.ok(value.durationMs >= QUIESCENT_RESIDENCY_MS && value.durationMs <= QUIESCENT_RESIDENCY_MS + 30000);
  assert.equal(value.samples.length, 5);
  for (const [index, sample] of value.samples.entries()) {
    assert.deepEqual(Object.keys(sample).sort(), [...NUMBERS, 'mappings'].sort());
    for (const key of NUMBERS) assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 0);
    assert.equal(sample.activeWorkers, 0); assert.ok(sample.createdWorkers > 0);
    assert.equal(sample.createdWorkers, sample.exitedWorkers);
    assert.equal(sample.createdWorkers, value.samples[0].createdWorkers);
    const elapsed = sample.elapsedMs - value.samples[0].elapsedMs;
    assert.ok(elapsed >= index * 30000 && elapsed <= index * 30000 + 30000);
    assertComparisonMappings(sample.mappings);
  }
  assert.ok(value.durationMs >= value.samples[4].elapsedMs - value.samples[0].elapsedMs);
}

/** No work generation or collection: only five observations after the caller's GC event. */
export async function observeQuiescentResidency({ sample, check, now = () => performance.now(), wait = delay }) {
  const started = now(), samples = [];
  let firstSampleAt;
  for (let index = 0; index < 5; index++) {
    if (index) while (now() < firstSampleAt + index * 30000) await wait(Math.ceil(firstSampleAt + index * 30000 - now()));
    assert.ok(now() - started <= QUIESCENT_RESIDENCY_MS + 30000, 'comparison_residency_deadline');
    check();
    const row = await sample(`post_stop_residency_${index}`);
    check();
    samples.push({ ...Object.fromEntries(NUMBERS.map(key => [key, row[key]])), mappings: row.mappings });
    if (index === 0) firstSampleAt = now();
  }
  const result = { version: 1, durationMs: Math.round(now() - started), samples };
  assertQuiescentResidency(result); return result;
}
