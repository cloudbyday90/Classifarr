/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { purposeCohortRow } from '../fixtures/purposeOutcomeFixture.mjs';
import { purposeEvaluationReport, purposeEvaluationSnapshot } from '../fixtures/automaticPurposeFixture.mjs';
import { readPurposeEvaluationReport } from '../../services/purposeEvaluationContract.mjs';
import { readPurposeEvaluationReport as readClientReport } from '../../../../client/src/utils/purposeEvaluationContract.js';
import { projectPurposeEvaluationStatus } from '../../services/purposeEvaluationStatus.mjs';
import { registerPurposeEvaluationSchedule, PURPOSE_EVALUATION_STARTUP_MS } from '../../services/purposeEvaluationScheduler.mjs';
import { createAutomaticPurposeEvaluation, purposeEvaluationFailure } from '../../services/automaticPurposeEvaluation.mjs';

test('empty retained choices do not imply intake or producer readiness and both contracts agree', () => {
  const report = purposeEvaluationReport();
  expect(report.phase).toBe('no_retained_choices');
  expect(report.limits).toMatchObject({ producerReadiness: 'not_assessed', providerCalls: 0, sourceWrites: 0, routingChanges: 0 });
  expect(readPurposeEvaluationReport(report)).toEqual(report); expect(readClientReport(report)).toEqual(report);
});
test('three comparisons and recorded action cohorts remain separate, with no private case data', () => {
  const row = purposeCohortRow(); row.source.decision_context = { classificationId: 1, capture: {
    version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId: 42, method: 'ai_analysis', status: 'completed', libraryId: 1 } };
  const second = purposeCohortRow({ classificationId: '2', tmdbId: 43, destination: 5, action: 'confirmation' });
  const report = purposeEvaluationReport([row, second]);
  expect(report.eligible).toBe(2); expect(report.phase).toBe('diagnostic_only');
  expect(report.comparisons).toEqual({ policyVersusChoice: { agrees: 1, differs: 1, unavailable: 0 },
    originalVersusChoice: { agrees: 0, differs: 1, unavailable: 1 }, policyVersusOriginal: { agrees: 0, differs: 1, unavailable: 1 } });
  expect(report.cohorts.correction.eligible).toBe(1); expect(report.cohorts.confirmation.eligible).toBe(1);
  expect(report.originalEvidence).toMatchObject({ available: 1, not_captured: 1 });
  expect(JSON.stringify(report)).not.toMatch(/classificationId|identityKey|tmdbId|libraryId|policyId|fingerprint|actor|snapshot|cases/);
  expect(readClientReport(report)).toEqual(report);
});
test('gaps and connected chronological holdouts precede all counts', () => {
  const first = purposeCohortRow(); first.supplement = null;
  const later = purposeCohortRow({ classificationId: '2', at: '2026-10-29T11:00:00.000Z' });
  const report = purposeEvaluationReport([later, first, structuredClone(first)]);
  expect(report).toMatchObject({ phase: 'no_eligible_choices', eligible: 0,
    coverage: { sourceRows: 3, canonicalEvents: 2, aliases: 1, duplicateItems: 1, gaps: { missing_supplement: 1 } } });
});
test.each([
  value => { value.private = 'PRIVATE' }, value => { value.eligible++ }, value => { value.coverage.aliases++ },
  value => { value.cohorts.confirmation.eligible++ }, value => { value.sources.manual.comparisons.policyVersusChoice.agrees++ },
  value => { value.originalEvidence.available++ }, value => { value.coverage.observedGaps.expired = -1 },
  value => { value.limits.producerReadiness = 'ready' }, value => { value.window.until = 'future' },
  value => { value.phase = 'accurate' }, value => { value.comparisons.policyVersusChoice.unavailable++ },
])('both closed contracts reject privacy, count and readiness drift', mutate => {
  const report = purposeEvaluationReport([purposeCohortRow()]); mutate(report);
  expect(readPurposeEvaluationReport(report)).toBeNull(); expect(readClientReport(report)).toBeNull();
});
test('saved status withholds stale/future/failed data and distinguishes missing sources', () => {
  const report = purposeEvaluationReport(), row = { status: 'complete', report, observed_at: report.window.until, next_check_at: '2026-10-29T12:05:00.000Z' };
  expect(projectPurposeEvaluationStatus(row, '2026-10-29T12:14:59.000Z').status).toBe('complete');
  expect(projectPurposeEvaluationStatus(row, '2026-10-29T12:15:00.000Z')).toMatchObject({ status: 'stale', report: null });
  expect(projectPurposeEvaluationStatus(row, '2026-10-29T11:59:59.000Z').status).toBe('invalid');
  for (const [failure_code, status] of [['sources_unavailable', 'unavailable'], ['memory_pressure', 'deferred'], ['deadline', 'failed']]) {
    expect(projectPurposeEvaluationStatus({ ...row, status: 'failed', failure_code }, row.observed_at)).toMatchObject({ status, report: null, reason: failure_code });
  }
  expect(projectPurposeEvaluationStatus(null, row.observed_at).status).toBe('never_run');
});
test('startup gate, no-overlap and worker replacement use the existing schedule pattern', async () => {
  let steady = 0; const old = { stop: jest.fn() }, worker = { run: jest.fn(async () => ({ status: 'deferred' })) };
  const scheduler = { purposeEvaluationWorker: old, schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerPurposeEvaluationSchedule(scheduler, { worker, steadyNow: () => steady });
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule.mock.calls[0][4]).toEqual({ noOverlap: true });
  await handler(); expect(worker.run).not.toHaveBeenCalled();
  steady = PURPOSE_EVALUATION_STARTUP_MS; await handler(); expect(worker.run).toHaveBeenCalledTimes(1);
  expect(old.stop).toHaveBeenCalledTimes(1);
});
test('worker owns admission through save, respects persisted cooldown and stops after shutdown', async () => {
  const repository = { readState: jest.fn(async () => null), assertIdle: jest.fn(), readSnapshot: jest.fn(async () => purposeEvaluationSnapshot()),
    save: jest.fn(async () => true), fail: jest.fn() };
  const events = [], withAdmission = async callback => { events.push('admit'); const result = await callback(new AbortController().signal); events.push('release'); return result; };
  const runThread = jest.fn(async () => ({ report: purposeEvaluationReport(), fingerprint: 'a'.repeat(64), unchanged: false }));
  repository.save.mockImplementation(async () => { events.push('save'); return true; });
  const worker = createAutomaticPurposeEvaluation({ withSessionAdvisoryLock: async (_key, fn) => fn() }, { repository, withAdmission, runThread });
  expect(await worker.run()).toMatchObject({ status: 'evaluated' }); expect(events).toEqual(['admit', 'save', 'release']);
  repository.readState.mockResolvedValue({ cooling_down: true }); expect((await worker.run()).status).toBe('cooldown');
  worker.stop(); expect((await worker.run()).status).toBe('stopped');
});
test.each([['purpose_evaluation_sources_unavailable', 'sources_unavailable'], ['purpose_cohort_input_budget', 'evidence_budget'],
  ['purpose_cohort_window', 'invalid_evidence'], ['purpose_evaluation_deadline', 'deadline'], ['PRIVATE', 'evaluation_unavailable']])('sanitizes %s failure', (message, code) => {
  expect(purposeEvaluationFailure(new Error(message))).toBe(code);
});
