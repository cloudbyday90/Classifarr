/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { buildFeedbackSelectionSnapshot, readFeedbackSelectionSnapshot, feedbackSnapshotMatchesReceipt } from '../../services/feedbackSelectionSnapshot.mjs';
import { readFeedbackOutcomeSnapshot } from '../../services/feedbackOutcomeSnapshot.mjs';
import { recordFeedbackSource } from '../../services/feedbackSourceReceipt.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { buildEvidenceGapAudit } from '../../services/evidenceGapAuditProjection.mjs';
import { gapAuditRow, gapAuditSnapshot } from '../fixtures/evidenceGapAuditFixture.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

const source = () => ({ id: '9223372036854775807', media_type: 'movie', tmdb_id: 41, title: 'PRIVATE',
  metadata: { classification_details: { ranked_candidates: [{ library_id: 2, title: 'PRIVATE' }] } } });
const snapshot = () => buildFeedbackSelectionSnapshot(source(), 3, 'standalone');
function selectionRow({ id = '1', destination = 2, reference = 2, available = true } = {}) {
  const row = gapAuditRow(); row.classification_id = id;
  const classification = { ...source(), id, metadata: { classification_details: { ranked_candidates: [{ library_id: reference }] } } };
  row.outcomes = [{ origin: 'legacy_feedback', classification_id: id, intake: 'standalone', observed_at: '2026-10-28T11:30:00.000Z',
    target_available: available, was_correction: false, feedback_snapshot: buildFeedbackSelectionSnapshot(classification, destination, 'standalone') }];
  return row;
}
test('captures a content-free selection with exact int64 binding and a named commit-time reference', () => {
  const value = snapshot();
  expect(value).toEqual({ version: 'classification.feedback_outcome.v2', classificationId: '9223372036854775807', mediaType: 'movie',
    tmdbId: 41, selectedLibraryId: 3, decisionContext: null, action: 'selection', intake: 'standalone',
    reference: { kind: 'server_shortlist_at_commit', libraryId: 2 }, referenceRelation: 'differs' });
  expect(readFeedbackOutcomeSnapshot(value)).toEqual(value);
  expect(JSON.stringify(value)).not.toContain('PRIVATE');
  expect(Buffer.byteLength(JSON.stringify(value))).toBeLessThan(1024);
  const original = source(), captured = buildFeedbackSelectionSnapshot(original, 2, 'prompt');
  original.metadata.classification_details.ranked_candidates[0].library_id = 99;
  expect(captured).toMatchObject({ action: 'selection', intake: 'prompt', reference: { libraryId: 2 }, referenceRelation: 'matches' });
});
test.each([null, true, '', ' 2', '02', 0, -1, 2147483648, '2147483648', 1.5, {}])
('unusable first reference %j remains unknown without trying another candidate', raw => {
  const classification = source(); classification.metadata.classification_details.ranked_candidates = [{ library_id: raw }, { library_id: 3 }];
  expect(buildFeedbackSelectionSnapshot(classification, 3, 'standalone')).toMatchObject({ action: 'selection', reference: null, referenceRelation: 'unknown' });
});
test.each([null, '01', '9223372036854775808', 9007199254740992, true, {}, '-1'])('rejects unbound classification ID %j', id => {
  expect(buildFeedbackSelectionSnapshot({ ...source(), id }, 3, 'standalone')).toBeNull();
});
test.each([
  v => { v.extra = 'PRIVATE' }, v => { v.action = 'confirmation' }, v => { v.intake = 'automatic' },
  v => { v.classificationId = 1 }, v => { v.referenceRelation = 'matches' },
  v => { v.reference.kind = 'browser_displayed' }, v => { v.reference.libraryId = '2' },
  v => { v.reference.extra = true }, v => { v.decisionContext = {} }, v => { v.mediaType = 'music' },
  v => { v.tmdbId = '41' }, v => { v.selectedLibraryId = null },
])('rejects malformed action, context and reference assertions', mutate => {
  const value = snapshot(); mutate(value); expect(readFeedbackSelectionSnapshot(value)).toBeNull();
});
test('both consumers must bind classification and intake to the independently queried receipt', () => {
  const value = snapshot(), receipt = { classification_id: value.classificationId, intake: 'standalone' };
  expect(feedbackSnapshotMatchesReceipt(value, receipt)).toBe(true);
  expect(feedbackSnapshotMatchesReceipt(value, { ...receipt, classification_id: '9223372036854775806' })).toBe(false);
  expect(feedbackSnapshotMatchesReceipt(value, { ...receipt, intake: 'prompt' })).toBe(false);
});
test('optional original decision context stays distinct from the shortlist and bound to the same item', () => {
  const classification = { ...source(), id: 1, method: 'ai_analysis' };
  classification.metadata.classification_details.destination_decision = buildClassificationDestinationDecision({
    metadata: classification, method: classification.method, status: 'completed', libraryId: 1 });
  const value = buildFeedbackSelectionSnapshot(classification, 2, 'standalone');
  expect(value).toMatchObject({ classificationId: '1', referenceRelation: 'matches',
    reference: { libraryId: 2 }, decisionContext: { classificationId: 1, capture: { libraryId: 1 } } });
  value.decisionContext.classificationId = 2; expect(readFeedbackSelectionSnapshot(value)).toBeNull();
  const encoded = source(); encoded.metadata = JSON.stringify(encoded.metadata);
  expect(buildFeedbackSelectionSnapshot(encoded, 3, 'standalone')).toMatchObject({ reference: { libraryId: 2 } });
});
test('the shared writer records v2 in the existing receipt transaction before later history edits', async () => {
  const classification = source(), client = { query: jest.fn(async () => ({})) };
  await recordFeedbackSource(client, { classificationId: classification.id, feedbackId: 1, intake: 'prompt', fingerprint: 'a'.repeat(64), classification, selectedLibraryId: 3 });
  expect(client.query.mock.calls[0][1][4]).toMatchObject({ version: 'classification.feedback_outcome.v2', action: 'selection', intake: 'prompt' });
});
test('selection equality and mutable raw flags cannot become a frozen confirmation or correction', () => {
  for (const reference of [2, 3, null]) {
    const row = selectionRow({ reference });
    expect(evaluateInventoryProspectiveOutcomes([row], { now: Date.parse('2026-10-28T12:00:00Z') })).toMatchObject({ sampleSize: 0,
      coverage: { selectionOnlyRows: 1, unknownKindRows: 0, unverifiedCaptures: 1 },
      kinds: { confirmation: { sampled: 0 }, correction: { sampled: 0 } } });
    const audit = buildEvidenceGapAudit(gapAuditSnapshot([row]).inputs);
    expect(audit).toMatchObject({ version: 'evidence_gap_audit.v2', observations: { reasons: { selectionOnlyRows: 1 } } });
  }
});
test('selections retain contradictions, availability diagnostics and early alias holdouts', () => {
  const held = selectionRow(), favorable = gapAuditRow(); held.outcomes.push(favorable.outcomes[0]);
  expect(buildEvidenceGapAudit(gapAuditSnapshot([held]).inputs).comparisons).toMatchObject({ eligible: 0, exclusions: { unverifiedCaptures: 1 } });
  const contradictory = selectionRow({ destination: 1, available: false }); contradictory.outcomes.push(favorable.outcomes[0]);
  expect(buildEvidenceGapAudit(gapAuditSnapshot([contradictory]).inputs)).toMatchObject({ comparisons: { exclusions: { conflicting: 1 } },
    observations: { reasons: { selectionOnlyRows: 1, unavailableOutcomeRows: 1 } } });
  const later = gapAuditRow(); later.classification_id = '2'; later.outcomes[0].classification_id = '2';
  expect(buildEvidenceGapAudit(gapAuditSnapshot([selectionRow(), later]).inputs).comparisons).toMatchObject({ eligible: 0,
    exclusions: { unverifiedCaptures: 1, duplicateIdentityOrDescription: 1 } });
});
test('intake or classification tampering fails the report instead of releasing its aliases', () => {
  const row = selectionRow(); row.outcomes[0].intake = 'prompt';
  expect(() => buildEvidenceGapAudit(gapAuditSnapshot([row]).inputs)).toThrow('invalid_evidence');
});
