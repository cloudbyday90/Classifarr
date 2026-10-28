/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { buildInventoryDisagreementReport } from '../../services/inventoryDisagreementReport.mjs';
import { disagreementRow, disagreementInputs, disagreementFeedback } from '../fixtures/inventoryDisagreementFixture.mjs';
import { chooseInventoryShadowCandidate } from '../../services/inventoryRankingShadow.mjs';

test('compares original and experimental decisions separately without a correctness label', () => {
  const report = buildInventoryDisagreementReport(disagreementInputs());
  expect(report.evaluation).toMatchObject({ sampleSize: 1, kinds: { correction: { gains: 1 } } });
  expect(report.cases[0]).toMatchObject({ classificationId: '1', original: { status: 'available', libraryId: 1 },
    assessment: { libraryId: 2, referenceKinds: ['manual_classification_change'] },
    comparisons: { originalVersusAssessment: 'differs', baselineVersusAssessment: 'differs', companyVersusAssessment: 'agrees', experimentalArms: 'differs' } });
  expect(report.cohorts.correction).toMatchObject({ sampled: 1, flagged: 1, baselineVersusAssessment: { differs: 1 } });
  expect(report.evidenceGaps).toMatchObject({ historicalIntent: 'not_frozen', fullPolicyRanking: 'not_frozen' });
  expect(report.interpretation.disagreementsAreNotErrorLabels).toBe(true);
});

test('v3 confirmation keeps the original reference and exact BIGINT; raw mutable flags cannot change its action', () => {
  const row = disagreementRow('9223372036854775807'); row.outcomes = [disagreementFeedback(row)];
  row.outcomes[0].was_correction = true;
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases[0]).toMatchObject({ classificationId: '9223372036854775807', cohort: 'confirmation',
    original: { status: 'available', libraryId: 1 }, assessment: { referenceKinds: ['original_automated_destination'] } });
  expect(report.cohorts.confirmation.sampled).toBe(1); expect(report.cohorts.correction.sampled).toBe(0);
});

test('does not turn current History or policy diagnostics into original-decision proof', () => {
  const row = disagreementRow(); row.outcomes[0].decision_context = null;
  row.original_decision = { version: 'classification.destination_decision.v1', mediaType: 'movie', tmdbId: 42,
    method: 'policy_auto', status: 'completed', libraryId: 2 };
  row.ranked_candidates = [{ library_id: 2, declared_policy: 'supporting' }];
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases[0].original).toEqual({ status: 'unavailable', libraryId: null, gaps: ['not_captured'] });
  expect(report.cases[0].comparisons.originalVersusAssessment).toBe('unavailable');
  expect(report.evidenceGaps.originalUnavailable).toBe(1);
});

test('pending runtime confirmation and History confirmation retain distinct reference meanings', () => {
  const row = disagreementRow(1, 42, 'confirmation'), pending = row.outcomes[0];
  pending.decision_context.capture.status = 'awaiting_decision'; pending.decision_context.capture.libraryId = null;
  pending.authorized_snapshot.event_key = 'runtime_resolution:1:aaaaaaaaaaaaaaaaaaaaaa';
  const feedback = disagreementFeedback(row); feedback.feedback_snapshot.decisionContext = null;
  row.outcomes.push(feedback);
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases[0].assessment.referenceKinds).toEqual(['original_automated_destination', 'runtime_operator_action']);
  expect(report.cases[0].original).toEqual({ status: 'available', libraryId: 1, gaps: ['not_completed'] });
  expect(report.evidenceGaps.partialOriginalSources).toBe(1);
  row.outcomes.pop();
  expect(buildInventoryDisagreementReport(disagreementInputs([row])).cases[0].original.status).toBe('unavailable');
});

test('contradictory frozen originals stay unassessed without changing a consistent experimental label', () => {
  const row = disagreementRow(), copy = structuredClone(row.outcomes[0]);
  copy.authorized_snapshot.event_key = 'classification_correction:2'; copy.decision_context.capture.libraryId = 2;
  row.outcomes.push(copy);
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.evaluation.sampleSize).toBe(1); expect(report.cases[0].original.status).toBe('conflicting');
  expect(report.cases[0].comparisons.originalVersusAssessment).toBe('unavailable');
  expect(report.evidenceGaps.originalConflicting).toBe(1);
});

test('an imported prior destination is not an original automated decision', () => {
  const row = disagreementRow(); row.outcomes[0].decision_context.capture.method = 'source_library';
  expect(buildInventoryDisagreementReport(disagreementInputs([row])).cases[0].original.gaps).toEqual(['not_automated']);
});
test('a bound retained correction carries its frozen original and source meaning', () => {
  const row = disagreementRow(); row.outcomes[0].origin = 'retained_correction'; row.outcomes[0].event_classification_id = 1;
  delete row.outcomes[0].authorized_snapshot;
  expect(buildInventoryDisagreementReport(disagreementInputs([row])).cases[0].assessment).toMatchObject({
    origins: ['retained_correction'], referenceKinds: ['manual_classification_change'] });
});

test('complete cohort gating and exact chronological ordering precede the 50-case display cap', () => {
  const rows = Array.from({ length: 80 }, (_, index) => disagreementRow(index + 1, index + 100));
  const first = disagreementRow(81, 42); first.outcomes = []; first.recorded_at = '2026-10-28T17:57:30.000Z';
  const retry = disagreementRow(82, 42); retry.capture.queryHash = first.capture.queryHash;
  rows.push(first, retry); rows.reverse();
  const report = buildInventoryDisagreementReport(disagreementInputs(rows));
  expect(report.evaluation).toMatchObject({ sampleSize: 80, coverage: { awaitingOutcome: 1, duplicateIdentityOrDescription: 1 } });
  expect(report.display).toMatchObject({ eligibleCases: 80, flaggedCases: 80, shownCases: 50, omittedCases: 30, truncated: true });
  expect(report.cases.map(row => row.classificationId)).toEqual(Array.from({ length: 50 }, (_, n) => String(n + 1)));
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(1024 * 1024);
});

test('unknown feedback evidence and unavailable contradictions do not become details', () => {
  const row = disagreementRow(), feedback = disagreementFeedback(row, 'correction');
  delete feedback.feedback_snapshot; feedback.feedback_snapshot = null; row.outcomes.push(feedback);
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases).toEqual([]); expect(report.evaluation.coverage.unverifiedCaptures).toBe(1);
  const bad = disagreementRow(); bad.outcomes.push({ ...bad.outcomes[0], selected_library_id: 1, target_available: false });
  expect(buildInventoryDisagreementReport(disagreementInputs([bad])).evaluation.coverage.conflicting).toBe(1);
});

test('unavailable company and abstentions are explicit, and output is an allowlist', () => {
  const row = disagreementRow(); row.capture.companyAvailable = false;
  row.capture.candidates.forEach(candidate => { candidate.companyFit = null; }); row.capture.combinedLibraryId = row.capture.baselineLibraryId;
  row.title = 'PRIVATE TITLE'; row.actor = 'PRIVATE ACTOR'; row.capture.credential = 'PRIVATE CREDENTIAL';
  const report = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(report.cases[0].comparisons.companyVersusAssessment).toBe('unavailable');
  expect(JSON.stringify(report)).not.toMatch(/PRIVATE|queryHash|snapshotId|reviewId|Fingerprint|sourceVersion|decision_context/);
  row.capture.candidates.forEach(candidate => { candidate.descriptionMean = 0; candidate.metadataFit = 0; });
  row.capture.baselineLibraryId = null; row.capture.combinedLibraryId = null;
  const abstained = buildInventoryDisagreementReport(disagreementInputs([row]));
  expect(abstained.cohorts.correction.baselineVersusAssessment.abstained).toBe(1);
});

test('malformed evidence and source overflow fail instead of improving a partial diagnostic', () => {
  const row = disagreementRow(); row.outcomes[0].authorized_snapshot.binding_valid = false;
  expect(() => buildInventoryDisagreementReport(disagreementInputs([row]))).toThrow('invalid_snapshot');
  expect(() => buildInventoryDisagreementReport(disagreementInputs(Array(5001).fill({})))).toThrow('budget');
});
test('maximum candidate lists retain a bounded response after display truncation', () => {
  const rows = Array.from({ length: 60 }, (_, index) => {
    const row = disagreementRow(index + 1, index + 100);
    row.capture.candidates = Array.from({ length: 64 }, (_, n) => ({ libraryId: n + 1,
      descriptionMean: 0.9876543210123456 - n / 100, metadataFit: 1.2345678901234567 - n / 100,
      companyFit: n / 100 - 0.9876543210123456 }));
    row.capture.baselineLibraryId = chooseInventoryShadowCandidate(row.capture.candidates);
    row.capture.combinedLibraryId = chooseInventoryShadowCandidate(row.capture.candidates, true);
    return row;
  });
  const report = buildInventoryDisagreementReport(disagreementInputs(rows));
  expect(report.display).toMatchObject({ shownCases: 50, omittedCases: 10, truncated: true });
  expect(report.cases[0].experiment.alternatives).toHaveLength(64);
  expect(Buffer.byteLength(JSON.stringify(report))).toBeLessThanOrEqual(1024 * 1024);
});
