/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { resourceStudyEnvironment } from '../helpers/resourceStudyEnvironment.mjs';
import { resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { assertStudyCgroup } from '../../scripts/resourceStudyMetrics.mjs';

jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: async () => {} }));
let sampler, rows, task, phase, foregroundCount, failForeground, skipOverlap;
const metrics = resourceStudyStartupFixture('image-capacity').metrics;
jest.unstable_mockModule('../../scripts/resourceStudyMetrics.mjs', () => ({ assertStudyCgroup,
  createStudySampler: async () => sampler, readStudyCgroup: async () => metrics }));
const foreground = jest.fn(async onRetrieval => {
  foregroundCount++;
  for (let i = 0; i < 40; i++) onRetrieval();
  if (failForeground) throw new Error('foreground_failed');
  return { inventory: foregroundCount * 80, durationMs: 10,
    scans: { count: 4, p50Ms: 1, p95Ms: 2, maxMs: 2 }, retrievals: { count: 40, p50Ms: 2, p95Ms: 3, maxMs: 3 } };
});
jest.unstable_mockModule('../../scripts/imageIndexMixedForeground.mjs', () => ({ createImageIndexMixedForeground: async () => foreground }));
const idle = jest.fn();
jest.unstable_mockModule('../../scripts/imageIndexStudyWorker.mjs', () => ({ awaitStudyIndexIdle: idle,
  executeStudyImageWorker: async options => {
    phase = options.phase;
    if (phase === 'stale_claim') return { exitCode: 75 };
    await sampler.sample(phase, {});
    if (!skipOverlap) { await options.onActivity({ phase: 'building index' }); await options.onActivity({ phase: 'building index' }); }
    const cancelled = phase === 'cancelled_build';
    return { exitCode: cancelled ? null : 0, signal: cancelled ? 'SIGTERM' : null,
      watchdog: false, interrupted: cancelled, durationMs: 100, databaseStopMs: 0 };
  } }));
jest.unstable_mockModule('../../services/imageIndexMaintenanceCatalog.mjs', () => ({
  inspectImageIndexes: async () => Array.from({ length: 3 }, () => ({ action: phase === 'cancelled_build' ? 'repair' : 'preserve' })) }));
const { runImageIndexMixedStudy } = await import('../../scripts/imageIndexMixedWorkload.mjs');
let old, query, release, db;
beforeEach(() => {
  old = process.env; process.env = { ...old, ...resourceStudyEnvironment };
  rows = foregroundCount = 0; phase = ''; failForeground = skipOverlap = false;
  sampler = { initial: metrics, samples: [], close: jest.fn(), sample: jest.fn(async () => {
    sampler.samples.push({ containerBytes: 1024, containerCores: 0.5 });
  }) };
  query = jest.fn(async sql => {
    if (sql.includes('SELECT gate_state')) return { rows: [{ gate_state: 'ready' }] };
    if (sql.includes('identity_sum')) return { rows: [{ rows, vectors: rows, history: rows, identity_sum: String(rows) }] };
    if (sql.includes('count(*)::integer n')) return { rows: [{ n: 0 }] };
    if (sql.includes('WITH inserted')) rows += 100;
    if (sql.includes('INSERT INTO task_queue')) { task = { id: '1', claim_token: 'before' }; return { rows: [task] }; }
    if (sql.includes('SELECT status,claim_token')) return { rows: [{ status: phase === 'cancelled_build' ? 'processing' : 'completed',
      claim_token: phase === 'cancelled_build' ? task.claim_token : null, work_mem_mib: 512 }] };
    if (sql.includes('SET claim_token=gen_random_uuid')) { task = { ...task, claim_token: 'after' }; return { rows: [task] }; }
    return { rows: [] };
  });
  release = jest.fn(); db = { pool: { connect: jest.fn(async () => ({ query, release })) } };
});
afterEach(() => { process.env = old; jest.clearAllMocks(); });

test('baseline, after-build load, interruption and fenced recovery produce validated evidence', async () => {
  const progress = jest.fn(), result = await runImageIndexMixedStudy(db, 'image-capacity', progress);
  expect(result.cases).toHaveLength(4); expect(result.staleClaimRejected).toBe(true);
  expect(result.cases[0].overlapRetrievals).toBe(0); expect(result.cases[1].overlapRetrievals).toBe(40);
  expect(progress).toHaveBeenCalledTimes(4); expect(foreground).toHaveBeenCalledTimes(4);
  expect(release).toHaveBeenCalledWith(true); expect(sampler.close).toHaveBeenCalled();
});
test.each(['budget', 'environment'])('refuses unsafe %s before opening a connection', async kind => {
  if (kind === 'environment') delete process.env.CLASSIFARR_RESOURCE_STUDY;
  await expect(runImageIndexMixedStudy(db, kind === 'budget' ? 'baseline' : 'image-capacity')).rejects.toThrow();
  expect(db.pool.connect).not.toHaveBeenCalled();
});
test('foreground failure is observed, joined and cannot become successful evidence', async () => {
  failForeground = true;
  await expect(runImageIndexMixedStudy(db, 'image-capacity')).rejects.toThrow('foreground_failed');
  expect(release).toHaveBeenCalledWith(true); expect(sampler.close).toHaveBeenCalled();
});
test('missing overlap is a failure even when the worker says it completed', async () => {
  skipOverlap = true;
  await expect(runImageIndexMixedStudy(db, 'image-capacity')).rejects.toThrow('mixed_study_build_overlap_missing');
  expect(foreground).toHaveBeenCalledTimes(1); expect(release).toHaveBeenCalledWith(true);
});
