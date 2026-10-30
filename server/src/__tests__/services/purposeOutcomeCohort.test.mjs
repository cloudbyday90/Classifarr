/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { livePurposeEvaluationFixture, purposeCohortRow, purposeCohortInput, PURPOSE_COHORT_NOW } from '../fixtures/purposeOutcomeFixture.mjs';
import { validPolicyEvaluationCapture } from '../../services/policyEvaluationCaptureContract.mjs';
import { buildPurposeOutcomeReference } from '../../services/purposeOutcomeReference.mjs';
import { buildPurposeOutcomeCohortReport } from '../../services/purposeOutcomeCohortReport.mjs';
import { readPurposeOutcomeCohort } from '../../services/purposeOutcomeCohortRead.mjs';
import { runInventoryOutcomeCalibration } from '../../scripts/runInventoryOutcomeCalibration.mjs';
import { createLivePolicyEvaluationCapture, getLivePolicyEvaluationCapture } from '../../services/policyEvaluationCapture.mjs';

test.each(['declared_native', 'profile_derived', 'mixed', 'unverified'])('v2 freezes live %s match and actual specialization', origin => {
  const fixture = livePurposeEvaluationFixture({ origin }), payload = fixture.capture.payload;
  expect(payload.version).toBe('policy_evaluation.v2'); expect(validPolicyEvaluationCapture(payload)).toBe(true);
  expect(payload.candidates[0].purposeEvidence).toMatchObject({ origin, specificity: fixture.ranked[0].candidate_diagnostics.identity_evidence.status_id });
  expect(Object.isFrozen(payload.candidates[0].purposeEvidence)).toBe(true);
  expect(JSON.stringify(payload)).not.toMatch(/Animation|require_any|operator_declared|fingerprint/);
});

test('serialized proof cannot become immutable live proof, and v1 stays readable without added evidence', () => {
  const fixture = livePurposeEvaluationFixture(), collector = createLivePolicyEvaluationCapture(fixture.item);
  collector.start([fixture.policy], [fixture.policy], 0); collector.record(structuredClone(fixture.raw));
  const capture = getLivePolicyEvaluationCapture(collector.finish({ ranked: structuredClone(fixture.ranked) }));
  expect(capture.payload.candidates[0].purposeEvidence).toBeNull();
  const legacy = structuredClone(fixture.capture.payload); legacy.version = 'policy_evaluation.v1';
  delete legacy.candidates[0].purposeEvidence;
  expect(validPolicyEvaluationCapture(legacy)).toBe(true);
  legacy.candidates[0].purposeEvidence = fixture.capture.payload.candidates[0].purposeEvidence;
  expect(validPolicyEvaluationCapture(legacy)).toBe(false);
});

test('contract changes after evaluation leave a proof gap without changing frozen numeric results', () => {
  const fixture = livePurposeEvaluationFixture();
  fixture.policy.policy_intent_contract.purpose[0].values.require_any = ['Horror'];
  const capture = getLivePolicyEvaluationCapture(fixture.collector.finish({ ranked: fixture.ranked }));
  expect(capture.payload.candidates[0].purposeEvidence).toBeNull();
  expect(capture.payload.ranked[0].score).toBe(fixture.ranked[0].score);
});

test('movie/TV identity and exact BIGINT classification ties remain distinct', () => {
  const movie = purposeCohortRow({ classificationId: '9223372036854775806' });
  const tv = purposeCohortRow({ classificationId: '9223372036854775807', mediaType: 'tv', action: 'confirmation', destination: 5 });
  const report = buildPurposeOutcomeCohortReport(purposeCohortInput([tv, movie]));
  expect(report.sampleSize).toBe(2);
  expect(report.cohorts).toEqual({ confirmation: { sampled: 1, agrees: 0, differs: 1 }, correction: { sampled: 1, agrees: 1, differs: 0 } });
});

test('policy leader agreement does not reinterpret a correction as confirmation', () => {
  const report = buildPurposeOutcomeCohortReport(purposeCohortInput([purposeCohortRow()]));
  expect(report.sampleSize).toBe(1); expect(report.cohorts.correction).toEqual({ sampled: 1, agrees: 1, differs: 0 });
  expect(report.cohorts.confirmation.sampled).toBe(0);
  expect(report.interpretation).toMatchObject({ agreementIsNotAccuracy: true, originalAutomatedDestinationCompared: false, noReceiptPopulation: 'unassessed' });
  expect(JSON.stringify(report)).not.toMatch(/classification_id|policyId|libraryId|movie:42|classification_correction|actor|snapshot/);
});

test('complete event aliases collapse before chronology and conflicts cannot disappear with an unavailable target', () => {
  const row = purposeCohortRow(), copy = structuredClone(row);
  expect(buildPurposeOutcomeCohortReport(purposeCohortInput([row, copy])).coverage).toMatchObject({ canonicalEvents: 1, aliases: 1 });
  copy.source.selected_library_id = 5; copy.source.target_available = false;
  const report = buildPurposeOutcomeCohortReport(purposeCohortInput([row, copy]));
  expect(report.sampleSize).toBe(0); expect(report.coverage.gaps.conflicting).toBe(1);
});

test('agreeing destinations cannot hide contradictory frozen decision contexts in tier aliases', () => {
  const row = purposeCohortRow(), copy = structuredClone(row);
  const context = { classificationId: 1, capture: { version: 'classification.destination_decision.v1', mediaType: 'movie',
    tmdbId: 42, method: 'ai_analysis', status: 'completed', libraryId: 1 } };
  row.source.decision_context = context;
  copy.source.decision_context = structuredClone(context); copy.source.decision_context.capture.libraryId = 2;
  const report = buildPurposeOutcomeCohortReport(purposeCohortInput([row, copy]));
  expect(report.sampleSize).toBe(0); expect(report.coverage.gaps.conflicting).toBe(1);
});

test('microsecond chronology and exact numeric source ties cannot favor a later matching event', () => {
  const first = purposeCohortRow({ classificationId: '2' }), later = purposeCohortRow({ classificationId: '1' });
  first.observed_order = String(BigInt(first.observed_order) + 1n);
  later.observed_order = String(BigInt(later.observed_order) + 2n); first.supplement = null;
  expect(buildPurposeOutcomeCohortReport(purposeCohortInput([later, first])).coverage.gaps.missing_supplement).toBe(1);
  const low = purposeCohortRow({ eventKey: 'classification_correction:2' }), high = purposeCohortRow({ eventKey: 'classification_correction:10' });
  low.source.source_id = '2'; high.source.source_id = '10'; low.supplement = null;
  expect(buildPurposeOutcomeCohortReport(purposeCohortInput([high, low])).sampleSize).toBe(0);
});

test.each(['missing_supplement', 'legacy_capture', 'expired', 'binding_failure'])('earliest %s proof reserves the item before a favorable retry', gap => {
  const first = purposeCohortRow(), retry = purposeCohortRow({ classificationId: '2', at: '2026-10-29T11:00:00.000Z' });
  if (gap === 'missing_supplement') first.supplement = null;
  if (gap === 'legacy_capture') { first.supplement.reason_id = gap; first.supplement.payload = null; first.supplement.expires_at = '2026-11-28T10:00:00.000Z'; }
  if (gap === 'expired') { first.supplement.expires_at = '2026-10-29T11:00:00.000Z'; first.supplement.payload = null; }
  if (gap === 'binding_failure') first.supplement.selected_library_id = 5;
  for (const rows of [[first, retry], [retry, first]]) {
    const report = buildPurposeOutcomeCohortReport(purposeCohortInput(rows));
    expect(report.sampleSize).toBe(0); expect(report.coverage.gaps[gap]).toBe(1); expect(report.coverage.duplicateItems).toBe(1);
  }
});

test('legacy unknown action reserves typed aliases without becoming a label', () => {
  const first = purposeCohortRow(); first.origin = 'feedback'; first.event_key = 'feedback_review:1';
  first.source = { classification_id: '1', intake: 'standalone', snapshot: { version: 'classification.feedback_outcome.v1',
    mediaType: 'movie', tmdbId: 42, selectedLibraryId: 4, decisionContext: null } };
  const report = buildPurposeOutcomeCohortReport(purposeCohortInput([first, purposeCohortRow({ classificationId: '2', at: '2026-10-29T11:00:00.000Z' })]));
  expect(report.sampleSize).toBe(0); expect(report.coverage.gaps.unknown_action).toBe(1); expect(report.coverage.duplicateItems).toBe(1);
});

test('a connected contradictory identity bridge holds out later retries independent of row order', () => {
  const first = purposeCohortRow(), bridge = purposeCohortRow({ classificationId: '2', tmdbId: 43, at: '2026-10-29T11:00:00.000Z' });
  bridge.holdout_identity = 'movie:42';
  const third = purposeCohortRow({ classificationId: '3', tmdbId: 43, at: '2026-10-29T11:30:00.000Z' });
  for (const rows of [[third, bridge, first], [first, third, bridge]]) {
    const report = buildPurposeOutcomeCohortReport(purposeCohortInput(rows));
    expect(report.sampleSize).toBe(1); expect(report.coverage.duplicateItems).toBe(2);
  }
});

test('late source evidence and old aliases cannot improve a commit-time gap or extend the source lease', () => {
  const fixture = livePurposeEvaluationFixture(), row = purposeCohortRow(), context = { classificationId: '1',
    mediaType: 'movie', identityKey: 'movie:42', observedAt: row.observed_at, priorAlias: true };
  expect(buildPurposeOutcomeReference(null, context, Date.parse(PURPOSE_COHORT_NOW)).reason).toBe('legacy_event');
  expect(row.supplement.expires_at).toBe(row.supplement.payload.expiresAt);
  expect(fixture.capture.payload.candidates[0].purposeEvidence.declaredMatch).toBe('matched');
});

test('whole-cohort malformed/budget input cannot produce a partial report', () => {
  expect(() => buildPurposeOutcomeCohortReport(purposeCohortInput(Array(5001).fill(purposeCohortRow())))).toThrow('input_budget');
  const row = purposeCohortRow(); row.supplement.payload.purposeEvidence.raw = 'PRIVATE';
  expect(() => buildPurposeOutcomeCohortReport(purposeCohortInput([row]))).toThrow('invalid_supplement');
});

function runtimeFixture(header = { events: 0, payload_bytes: '0', input: null }) {
  const client = { query: jest.fn(async sql => sql.startsWith('SELECT date_trunc') ? { rows: [{ observed_at: PURPOSE_COHORT_NOW }] } :
    sql.startsWith('WITH authorized') ? { rows: [header] } : { rows: [] }) };
  return { client, close: jest.fn(), withTransaction: jest.fn(async callback => callback(client)) };
}
test('new aggregate CLI mode owns a coherent cancellable read and closes its runtime', async () => {
  const runtime = runtimeFixture();
  const result = await runInventoryOutcomeCalibration({ argv: ['--prospective-purpose'], load: async () => runtime });
  expect(result.sampleSize).toBe(0); expect(runtime.close).toHaveBeenCalledTimes(1);
  expect(runtime.withTransaction.mock.calls[0][1]).toMatchObject({ readOnly: true, isolationLevel: 'repeatable_read', timeoutMs: 15000 });
  await expect(runInventoryOutcomeCalibration({ argv: ['--prospective-purpose', '--prospective'], load: async () => runtime })).rejects.toThrow('mode_options');
});
test('read admission and cancellation fail closed without leaking runtime details', async () => {
  const runtime = runtimeFixture({ events: 5001, payload_bytes: '1', input: null });
  await expect(readPurposeOutcomeCohort(runtime)).rejects.toThrow('input_budget');
  const controller = new AbortController(); controller.abort();
  await expect(readPurposeOutcomeCohort(runtime, { signal: controller.signal })).rejects.toThrow();
});
