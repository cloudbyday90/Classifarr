/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { createComparisonStudySchedule } from '../../scripts/comparisonMemoryStudy/schedule.mjs';
import { assertComparisonRecoveryReceipt, comparisonRecoveryEvidence } from '../../scripts/comparisonMemoryStudy/recoveryContract.mjs';
import { resourceStudyStartupFixture } from '../helpers/resourceStudyReceiptFixture.mjs';
import { runResourceStudyCompose } from '../../../../scripts/lib/resourceStudyCompose.mjs';
import { formatResourceStudySummary } from '../../../../scripts/lib/resourceStudySummary.mjs';

const task = 'inventory-multi-scale-context';
function schedulerFixture(execute = async (_kind, _attempt, callback) => callback()) {
  const callbacks = [], destroy = jest.fn(), clearTimer = jest.fn();
  const scheduler = createComparisonStudySchedule({ execute,
    createTask: jest.fn((_expression, callback) => { callbacks.push(callback); return { destroy }; }),
    setTimer: jest.fn(callback => { callbacks.push(callback); return 42; }), clearTimer });
  return { scheduler, callbacks, destroy, clearTimer };
}
test('real cadence contract rejects changed expressions, overlap policy and initial deadlines', async () => {
  const { scheduler } = schedulerFixture();
  expect(() => scheduler.schedule('unknown', '* * * * *', () => {}, null, { noOverlap: true })).toThrow();
  expect(() => scheduler.schedule(task, '* * * * * *', () => {}, null, { noOverlap: true })).toThrow();
  expect(() => scheduler.schedule(task, '45 * * * * *', () => {}, null, {})).toThrow();
  scheduler.schedule(task, '45 * * * * *', () => {}, null, { noOverlap: true });
  expect(() => scheduler.scheduleInitial(task, 1, () => {})).toThrow();
  scheduler.scheduleInitial(task, 180_000, () => {});
  expect(() => scheduler.scheduleInitial(task, 180_000, () => {})).toThrow();
  await scheduler.close(() => {});
});
test('shutdown prevents new work, stops workers and joins the already admitted callback', async () => {
  let finish;
  const f = schedulerFixture(), worker = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  f.scheduler.schedule(task, '45 * * * * *', worker, null, { noOverlap: true });
  f.scheduler.scheduleInitial(task, 180_000, worker);
  const pending = f.callbacks[0](); await Promise.resolve();
  const stop = jest.fn(() => finish()); await f.scheduler.close(stop); await pending;
  await f.callbacks[0](); f.callbacks[1]();
  expect(worker).toHaveBeenCalledTimes(1); expect(stop).toHaveBeenCalledTimes(1);
  expect(f.destroy).toHaveBeenCalledTimes(1); expect(f.clearTimer).toHaveBeenCalledWith(42);
  expect(f.scheduler.active).toBe(0);
});
test('callback failures and excessive callbacks remain failures after cleanup', async () => {
  const f = schedulerFixture();
  f.scheduler.schedule(task, '45 * * * * *', async () => {}, null, { noOverlap: true });
  for (let i = 0; i < 61; i++) await f.callbacks[0]();
  expect(() => f.scheduler.check()).toThrow('comparison_recovery_callback_budget');
  const stop = jest.fn(); await expect(f.scheduler.close(stop)).rejects.toThrow('comparison_recovery_callback_budget');
  expect(stop).toHaveBeenCalledTimes(1); expect(f.scheduler.active).toBe(0);
  const g = schedulerFixture();
  g.scheduler.schedule(task, '45 * * * * *', async () => { throw new Error('failed'); }, null, { noOverlap: true });
  await g.callbacks[0](); expect(() => g.scheduler.check()).toThrow('failed');
  await expect(g.scheduler.close(() => {})).rejects.toThrow('failed');
});
function receipt() {
  const initial = resourceStudyStartupFixture('bounded').metrics;
  const attempts = ['deferred', 'ready', 'revalidated'].map((status, i) => ({ worker: 'comparison',
    attempt: i + 1, elapsedMs: [360_000, 480_000, 790_000][i], status, reason: i ? null : 'memory_pressure' }));
  const decisions = attempts.map((row, i) => ({ worker: row.worker, attempt: row.attempt, kind: 'discovery',
    elapsedMs: row.elapsedMs - 1, allowed: i !== 0, reason: row.reason,
    availableBytes: (i ? 1500 : 1000) * 1024 ** 2, reserveBytes: 256 * 1024 ** 2, reservedBytes: 0,
    workBytes: 768 * 1024 ** 2, hysteresisBytes: (i === 1 ? 64 : 0) * 1024 ** 2,
    requiredBytes: (i === 1 ? 1088 : 1024) * 1024 ** 2 }));
  return { version: 'comparison_recovery.v1', status: 'measured', profile: 'comparison-recovery', budget: 'bounded',
    durationMs: 800_000, initial, final: { ...initial }, sourceChanges: 1, attempts, decisions,
    measurement: { createdWorkers: 2, exitedWorkers: 2, activeWorkers: 0 },
    admission: { ingestion: { active: 0 }, queue: { active: 0 }, discovery: { active: 0 } } };
}
test('requires an actual shared-budget deferral, natural recovery and later revalidation', () => {
  const study = receipt(); expect(() => assertComparisonRecoveryReceipt(study, 'bounded')).not.toThrow();
  expect(comparisonRecoveryEvidence(study.attempts, study.decisions).revalidated.attempt).toBe(3);
  expect(formatResourceStudySummary({ mode: study.profile, cleanup: 'passed', budget: study.budget, study }))
    .toContain('not full application scheduler or capacity evidence');
});
test.each([
  s => { s.attempts[0].reason = 'busy'; }, s => { s.decisions[0].worker = 'representative'; },
  s => { s.attempts[2].status = 'not_due'; }, s => { s.attempts[2].elapsedMs = 700_000; },
  s => { s.decisions[1].allowed = false; }, s => { s.decisions[0].requiredBytes = 1; },
  s => { s.measurement.activeWorkers = 1; }, s => { s.measurement.exitedWorkers = 1; },
  s => { s.admission.discovery.active = 1; }, s => { s.final.oomKill = 1; },
  s => { s.final.memoryLimitHits = 1; }, s => { s.sourceChanges = 0; },
  s => { s.attempts[1].attempt = s.attempts[0].attempt; }, s => { s.decisions = []; },
])('incomplete or contradictory recovery evidence fails (%#)', change => {
  const study = receipt(); change(study); expect(() => assertComparisonRecoveryReceipt(study, 'bounded')).toThrow();
});
test.each([false, true])('isolated launcher validates recovery and cleans after failure=%s', async failed => {
  const imageId = `sha256:${'a'.repeat(64)}`, save = jest.fn(), saveTrace = jest.fn();
  const run = jest.fn((_command, args) => {
    let stdout = '';
    if (args[0] === 'image' && args[1] === 'inspect') stdout = imageId;
    if (args[0] === 'inspect') stdout = args[2].includes('HostConfig')
      ? JSON.stringify({ nanoCpus: 2e9, pids: 128, memoryBytes: 2 * 1024 ** 3, cpuQuota: 0, imageId }) : 'false healthy';
    if (args[0] === 'compose' && args.includes('ps')) stdout = 'b'.repeat(64);
    if (args.includes('src/scripts/publishedUpgradeProbe.mjs')) stdout = 'UPGRADE_PROBE {"status":"passed"}';
    if (args.includes('src/scripts/runResourceStudy.mjs')) {
      const action = args.at(-1);
      if (action === 'comparison-recovery') return { status: failed ? 1 : 0, stderr: '',
        stdout: 'STUDY_PROGRESS {"phase":"recovery_comparison","status":"deferred"}\n' +
          `RESOURCE_STUDY ${JSON.stringify(receipt())}` };
      stdout = `RESOURCE_STUDY ${JSON.stringify(action === 'seed' ? { seeded: true } : resourceStudyStartupFixture('bounded'))}`;
    }
    return { status: 0, stdout, stderr: '' };
  });
  const pending = runResourceStudyCompose({ mode: 'comparison-recovery', budget: 'bounded', candidateImageId: imageId,
    run, save, saveTrace, report: () => {}, random: size => Buffer.alloc(size, 4) });
  if (failed) await expect(pending).rejects.toThrow();
  else await expect(pending).resolves.toMatchObject({ cleanup: 'passed', imageId });
  expect(save).toHaveBeenCalledTimes(failed ? 0 : 1); expect(saveTrace).toHaveBeenCalledTimes(1);
  expect(run.mock.calls.some(([, args]) => args.includes('down') && args.includes('--volumes'))).toBe(true);
  expect(run.mock.calls.some(([, args]) => args.includes('build'))).toBe(false);
});
