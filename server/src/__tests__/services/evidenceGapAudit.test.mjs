/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { buildEvidenceGapAudit } from '../../services/evidenceGapAuditProjection.mjs';
import { readEvidenceGapAuditReport } from '../../services/evidenceGapAuditContract.mjs';
import { projectEvidenceGapAuditStatus } from '../../services/evidenceGapAuditStatus.mjs';
import { createAutomaticEvidenceGapAudit } from '../../services/automaticEvidenceGapAudit.mjs';
import { registerEvidenceGapAuditSchedule, EVIDENCE_GAP_AUDIT_STARTUP_MS } from '../../services/evidenceGapAuditScheduler.mjs';
import { gapAuditReport, gapAuditSnapshot, gapAuditRow } from '../fixtures/evidenceGapAuditFixture.mjs';

test('empty and capped intake are honest populations, not classifier accuracy or recoverability', () => {
  const report = gapAuditReport();
  expect(report.evidencePhase).toBe('awaiting_classification_intake');
  expect(report.limits).toMatchObject({ historicalRecovery: 'not_assessed', providerCalls: 0, sourceWrites: 0 });
  const capped = buildEvidenceGapAudit(gapAuditSnapshot([], 5001).inputs);
  expect(capped.intake).toEqual({ recordedMovieTvEvents: 5001, capped: true, withoutRetainedComparison: null });
  expect(readEvidenceGapAuditReport(capped)).toEqual(capped);
});

test('capture exclusions reconcile while overlapping observation reasons are never summed into items', () => {
  const valid = gapAuditRow(), legacy = gapAuditRow(2), source = gapAuditRow(3);
  legacy.capture.version = 'inventory_description_company_shadow_v1'; delete legacy.capture.identityKey; legacy.outcomes = [];
  source.outcomes[0].identity_key = `source:${'a'.repeat(64)}`; source.outcomes[0].tmdb_id = null; source.outcomes[0].target_available = false;
  const report = buildEvidenceGapAudit(gapAuditSnapshot([valid, legacy, source], 4).inputs);
  expect(report.comparisons).toMatchObject({ inspected: 3, eligible: 1, exclusions: { unboundCaptures: 1, unverifiedCaptures: 1 } });
  expect(report.observations.reasons).toMatchObject({ identityMismatchRows: 1, sourceOnlyRows: 1, unavailableOutcomeRows: 1 });
  expect(report.intake.withoutRetainedComparison).toBe(1);
  expect(JSON.stringify(report)).not.toMatch(/identity_key|queryHash|classification_id|selected_library_id|candidate|fingerprint/);
});

test('overflow in a duplicate capture still marks observation diagnostics as bounded', () => {
  const first = gapAuditRow(), duplicate = gapAuditRow();
  duplicate.classification_id = '2'; duplicate.outcomes[0].classification_id = '2';
  duplicate.outcomes = Array(101).fill(duplicate.outcomes[0]);
  const report = buildEvidenceGapAudit(gapAuditSnapshot([first, duplicate]).inputs);
  expect(report.comparisons).toMatchObject({ inspected: 2, eligible: 1, observationOverflowCaptures: 0,
    exclusions: { duplicateIdentityOrDescription: 1 } });
  expect(report.observations).toMatchObject({ groupsAtLimit: 1, mayBeTruncated: true });
});

test.each([
  value => { value.comparisons.eligible = 1 }, value => { value.observations.reasons.sourceOnlyRows = 505001 },
  value => { value.intake.withoutRetainedComparison = 1 }, value => { value.limits.historicalRecovery = 'recoverable' },
  value => { value.private = 'secret' }, value => { value.window.until = 'future' },
])('malformed arithmetic, privacy and recovery claims are rejected', mutate => {
  const value = gapAuditReport(); mutate(value); expect(readEvidenceGapAuditReport(value)).toBeNull();
});

test('saved status uses source observation time, withholds stale/future/failed data and never turns a failure into zero', () => {
  const report = gapAuditReport(), row = { status: 'complete', report, observed_at: report.window.until,
    next_check_at: '2026-10-28T12:05:00.000Z' };
  expect(projectEvidenceGapAuditStatus(row, '2026-10-28T12:14:59.000Z').status).toBe('complete');
  expect(projectEvidenceGapAuditStatus(row, '2026-10-28T12:15:00.000Z')).toMatchObject({ status: 'stale', report: null });
  expect(projectEvidenceGapAuditStatus(row, '2026-10-28T11:59:59.000Z')).toMatchObject({ status: 'invalid', report: null });
  expect(projectEvidenceGapAuditStatus({ ...row, status: 'failed', failure_code: 'memory_pressure' }, row.observed_at))
    .toMatchObject({ status: 'deferred', reason: 'memory_pressure', report: null });
  expect(projectEvidenceGapAuditStatus(null, row.observed_at).status).toBe('never_run');
});

test('shared lifecycle coalesces work, quiet deferrals and stop without publishing or persisting failure', async () => {
  let release;
  const repository = { readState: jest.fn(async () => null), assertIdle: jest.fn(async () => {}),
    readSnapshot: jest.fn(() => new Promise(resolve => { release = resolve })), save: jest.fn(async () => true), fail: jest.fn(async () => {}) };
  const database = { withSessionAdvisoryLock: async (_lock, callback) => { await callback(); return true } };
  const runThread = jest.fn(async () => ({ fingerprint: 'a'.repeat(64), report: gapAuditReport(), unchanged: false }));
  const worker = createAutomaticEvidenceGapAudit(database, { repository, runThread,
    withAdmission: (callback, { signal }) => callback(signal) });
  const active = worker.run(); expect(worker.run()).toBe(active);
  while (!release) await Promise.resolve();
  worker.stop(); release(gapAuditSnapshot());
  expect(await active).toMatchObject({ status: 'stopped' });
  expect(repository.save).not.toHaveBeenCalled(); expect(repository.fail).not.toHaveBeenCalled();
});

test('startup guard covers cron as well as delayed start, and replacing scheduler work stops the old worker', async () => {
  let now = 0;
  const old = { stop: jest.fn() }, worker = { run: jest.fn(async () => ({ status: 'deferred', reason: 'busy' })), stop: jest.fn() };
  const scheduler = { evidenceGapAuditWorker: old, schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerEvidenceGapAuditSchedule(scheduler, { worker, steadyNow: () => now });
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(await handler()).toMatchObject({ reason: 'startup' }); expect(worker.run).not.toHaveBeenCalled();
  now = EVIDENCE_GAP_AUDIT_STARTUP_MS;
  expect(await handler()).toMatchObject({ status: 'deferred', reason: 'busy' });
  expect(old.stop).toHaveBeenCalledTimes(1);
  worker.run.mockResolvedValue({ status: 'failed' }); await expect(handler()).rejects.toThrow('unavailable');
});
