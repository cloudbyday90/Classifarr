/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { performance, PerformanceObserver, constants } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { verifyArchiveRestore } from '/app/src/ollamaGateway/archiveVerifier.mjs';
import { readVerifiedGatewayArchive } from '/app/src/ollamaGateway/archiveFiles.mjs';
import { readResidentText } from '/app/src/scripts/comparisonMemoryStudy/residentMemory.mjs';
import * as parsers from '/app/src/scripts/comparisonMemoryStudy/residentMemoryParsers.mjs';
import { RESTORE_STUDY, restoreStudyLane, validateRestoreIdentity, requireRestoreReceipt, runRestoreStudySequence } from './restoreStudyContract.mjs';
import { createRestoreMeasurements, requireRestoreCoverage } from './restoreStudyMetrics.mjs';
import { sampleRestoreAllocations, requireRestoreHeapSummary } from './restoreStudyHeap.mjs';
import { qualificationResources } from './archiveQualificationResources.mjs';
import { createStudyResourceSample } from './studyResource.mjs';

assert.equal(process.env.CLASSIFARR_GATEWAY_FIXTURE, 'isolated');
assert.equal(process.env.NODE_OPTIONS, undefined); assert.equal(process.execArgv.length, 0);
const lane = restoreStudyLane(process.argv[2]), controller = new AbortController();
const stop = () => controller.abort(); process.once('SIGTERM', stop); process.once('SIGINT', stop);
const timer = setTimeout(stop, lane === 'natural' ? RESTORE_STUDY.naturalMs : RESTORE_STUDY.allocationsMs);
let sampler, metrics, resources, observer, gcFailure = false, cycleCount = 0, stage = 'identity';
const gc = { events: 0, major: 0, forced: 0, durationMs: 0 };
const recordGc = entries => {
  try {
    for (const entry of entries) {
      assert.ok(Number.isFinite(entry.duration) && entry.duration >= 0 && gc.events < 100000);
      gc.events++; gc.durationMs += entry.duration;
      if (entry.detail.kind === constants.NODE_PERFORMANCE_GC_MAJOR) gc.major++;
      if (entry.detail.flags & constants.NODE_PERFORMANCE_GC_FLAGS_FORCED) gc.forced++;
    }
  } catch { gcFailure = true; controller.abort(); }
};
try {
  const raw = await readFile('/results/restore-source.json', 'utf8'); assert.ok(Buffer.byteLength(raw) <= 2048);
  const identity = validateRestoreIdentity(JSON.parse(raw)), directory = `/catalogs/gateway-archive-${identity.archiveId}`;
  const { manifest, manifestSha256 } = await readVerifiedGatewayArchive(directory, controller.signal);
  assert.equal(manifest.version, 7); assert.equal(manifest.catalog.version, 3);
  assert.equal(manifestSha256, identity.manifestSha256); assert.equal(manifest.dump.sha256, identity.dumpSha256);
  resources = await qualificationResources(); console.log(JSON.stringify({ fixture: 'restore-limits', lane, ...resources.limits }));
  const readSample = createStudyResourceSample({ version: resources.limits.version, read: readResidentText, parsers, extra: async () => {
    const usage = process.memoryUsage(), heap = getHeapStatistics();
    return { ...usage, heapPhysical: heap.total_physical_size, v8Malloc: heap.malloced_memory };
  } });
  metrics = createRestoreMeasurements(readSample);
  observer = new PerformanceObserver(list => recordGc(list.getEntries())); observer.observe({ entryTypes: ['gc'] });
  sampler = setInterval(() => { void metrics.tick(); }, 1000);
  await runRestoreStudySequence({ lane, signal: controller.signal,
    pause: ms => delay(ms, undefined, { signal: controller.signal }),
    boundary: async (phase, cycle) => { stage = phase; await metrics.phase(phase, cycle); },
    restore: async cycle => {
      assert.deepEqual(await readdir('/verification'), []);
      const started = performance.now(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(RESTORE_STUDY.restoreMs)]);
      const work = () => verifyArchiveRestore(directory, '/verification', signal, { archives: '/archives', receipts: '/receipts' });
      const { value, profile } = lane === 'allocations' ? await sampleRestoreAllocations(work) : { value: await work(), profile: null };
      requireRestoreReceipt(value, identity); assert.deepEqual(await readdir('/verification'), []);
      // The private PID namespace and packaged stop fence must leave no child process behind.
      const ids = (await readdir('/proc')).filter(value => /^[1-9][0-9]*$/.test(value)); assert.ok(ids.length <= 64);
      assert.ok(ids.every(id => id === '1' || Number(id) === process.pid), 'restore_study_process_left_behind');
      signal.throwIfAborted(); cycleCount++;
      if (profile) requireRestoreHeapSummary(profile);
      console.log(JSON.stringify({ fixture: 'restore-cycle', lane, cycle, durationMs: performance.now() - started,
        verified: true, scratchEmpty: true, noChildren: true, ...(profile ? { profile } : {}) }));
    } });
  clearInterval(sampler); await metrics.stop(); recordGc(observer.takeRecords()); observer.disconnect(); assert.equal(gcFailure, false);
  assert.equal(cycleCount, 5); requireRestoreCoverage(metrics.summary(), lane);
  if (lane === 'natural') assert.equal(gc.forced, 0);
  const final = await resources.metrics();
  assert.ok(Object.values(final.memoryEvents).every(value => Number(value) === 0));
  assert.ok(final.pidsEvents.split(/\s+/).every(value => value === 'max' || value === '0'));
  console.log(JSON.stringify({ fixture: 'restore-study', lane, passed: true, cycles: cycleCount, gc, ...final, observations: metrics.summary() }));
} catch {
  clearInterval(sampler); await metrics?.stop();
  console.log(JSON.stringify({ fixture: 'restore-study-failed', lane, stage, cycles: cycleCount,
    ...(metrics ? { observations: metrics.summary() } : {}) })); process.exitCode = 1;
} finally {
  clearInterval(sampler); clearTimeout(timer); observer?.disconnect();
  process.removeListener('SIGTERM', stop); process.removeListener('SIGINT', stop);
}
