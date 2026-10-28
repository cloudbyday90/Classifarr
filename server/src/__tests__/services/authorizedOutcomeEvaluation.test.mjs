/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { prepareInventoryOutcomeLabels, inventoryOutcomeIdentity } from '../../services/inventoryOutcomeLabels.mjs';
import { readDestinationOutcomes } from '../../services/destinationOutcomeEvaluationRepository.mjs';
import { authorizedOutcomeDecisionContext, prepareAuthorizedOutcomeEvaluationRows } from '../../services/authorizedOutcomeEvaluationSnapshot.mjs';
import { evaluateDestinationOutcomes } from '../../services/destinationOutcomeEvaluation.mjs';
import { readAutomaticDestinationEvaluationReport } from '../../services/automaticDestinationEvaluationReport.mjs';
import { authorizedEvaluationRow as row, authorizedEvaluationGap as gap } from '../helpers/authorizedOutcomeEvaluationFixture.mjs';

const docs = [{ key: 'movie:42', libraryIds: [1] }, { key: 'tv:42', libraryIds: [3] }];
const libs = [{ id: 1, media_type: 'movie' }, { id: 2, media_type: 'movie' }, { id: 3, media_type: 'tv' }];

test('historical gaps change coverage without acquiring current identity, labels or an agreement denominator', () => {
  const result = prepareInventoryOutcomeLabels([gap()], docs, libs);
  expect(result.labels.size).toBe(0);
  expect(result.coverage).toMatchObject({ eligibleRows: 0, invalidRows: 0, authorizedMissingSnapshotRows: 1, labeledIdentities: 0 });
  expect(inventoryOutcomeIdentity(gap())).toBeNull();
  const report = evaluateDestinationOutcomes([], [], 1);
  expect(report).toMatchObject({ status: 'complete', authorizedOutcomes: { missingSnapshotRows: 1 },
    overall: { completedDecisions: 0, labeledCohortAgreementRate: null }, promotionAllowed: false });
  const previous = { ...report }; delete previous.authorizedOutcomes;
  expect(readAutomaticDestinationEvaluationReport(previous)).toBeNull();
});

test('keeps confirmation/change observations separate and movie/TV numeric identities distinct', () => {
  const confirmation = row({ media_type: 'tv', identity_key: 'tv:42', selected_library_id: 3,
    classification_id: '2', was_correction: false, decision_context: null,
    authorized_snapshot: { ...row().authorized_snapshot, event_key: 'classification_correction:2', action_kind: 'confirmation' } });
  const result = prepareInventoryOutcomeLabels([row(), confirmation], docs, libs);
  expect([...result.labels]).toEqual([['movie:42', { libraryId: 2, kind: 'correction' }], ['tv:42', { libraryId: 3, kind: 'confirmation' }]]);
  expect(result.coverage).toMatchObject({ authorizedConfirmationRows: 1, authorizedCorrectionRows: 1, corrections: 1, confirmations: 1 });
});

test('deduplicates tier aliases without counting a later receipt as another observation', () => {
  const result = prepareInventoryOutcomeLabels([row(), row({ observed_at: new Date('2026-10-28T00:01:00Z') })], docs, libs);
  expect(result.coverage).toMatchObject({ eligibleRows: 1, authorizedCorrectionRows: 1, labeledIdentities: 1 });
});

test.each([false, true])('retains contradictory unavailable targets before exclusion, reversed=%s', reversed => {
  const conflicting = row({ selected_library_id: 99, target_available: false,
    authorized_snapshot: { ...row().authorized_snapshot, event_key: 'classification_correction:2' } });
  const rows = reversed ? [conflicting, row()] : [row(), conflicting];
  expect(prepareInventoryOutcomeLabels(rows, docs, libs)).toMatchObject({ coverage: { conflictingIdentities: 1 } });
  expect(prepareInventoryOutcomeLabels(rows, docs, libs).labels.size).toBe(0);
  expect(inventoryOutcomeIdentity(conflicting)).toBe('movie:42');
  expect(prepareInventoryOutcomeLabels([conflicting], docs, libs).coverage.unavailableIdentities).toBe(1);
});

test('conflicting identity copies of one event invalidate both identities instead of voting', () => {
  const other = row({ media_type: 'tv', identity_key: 'tv:42', selected_library_id: 3, decision_context: null });
  const result = prepareInventoryOutcomeLabels([row(), other], docs, libs);
  expect(result.labels.size).toBe(0);
  expect(result.coverage.conflictingIdentities).toBe(2);
  expect(prepareAuthorizedOutcomeEvaluationRows([row(), other]).every(value => value.evidence_conflict)).toBe(true);
});

test.each([
  value => { value.authorized_snapshot.binding_valid = false; },
  value => { value.authorized_snapshot.snapshot_version = 2; },
  value => { value.authorized_snapshot.action_kind = 'automatic'; },
  value => { value.authorized_snapshot.extra = 'private'; },
  value => { value.decision_context.capture.mediaType = 'tv'; },
  value => { value.classification_id = '2'; },
  value => { value.identity_key = 'movie:0042'; },
])('malformed frozen evidence fails the whole read rather than improving a partial cohort', mutate => {
  const invalid = row(); mutate(invalid);
  expect(() => prepareInventoryOutcomeLabels([row(), invalid], docs, libs)).toThrow('authorized_evaluation_invalid');
});

test('runtime method changes preserve a valid original frozen classifier context; identity drift does not', () => {
  const classification = { id: 1, tmdb_id: 42, media_type: 'movie', method: 'manual_classification',
    metadata: { classification_details: { destination_decision: row().decision_context.capture } } };
  expect(authorizedOutcomeDecisionContext(classification)).toEqual(row().decision_context);
  expect(authorizedOutcomeDecisionContext({ ...classification, tmdb_id: 43 })).toBeNull();
});

test('saved-decision intake accounts for gaps separately and keeps the three-query budget boundary', async () => {
  const client = { query: async () => ({ rows: [] }) };
  let index = 0;
  client.query = async () => ({ rows: [[row(), gap()], [], []][index++] });
  expect(await readDestinationOutcomes(client)).toMatchObject({ retainedRows: 1,
    authorizedOutcomes: { missingSnapshotRows: 1, correctionRows: 1, confirmationRows: 0 },
    overall: { completedDisagreement: 1 } });
  index = 0; client.query = async () => ({ rows: [Array(5000).fill(gap()), [row()], []][index++] });
  await expect(readDestinationOutcomes(client)).rejects.toThrow('row_budget');
  expect(() => evaluateDestinationOutcomes([row()], [], 5000)).toThrow('row_budget');
});

const confirmation = (overrides = {}) => row({ was_correction: false, selected_library_id: 1,
  authorized_snapshot: { ...row().authorized_snapshot, action_kind: 'confirmation' }, ...overrides });

test('saved-decision confirmation and change agreement use separate decision denominators and media breakdowns', () => {
  const tv = confirmation({ classification_id: '2', media_type: 'tv', identity_key: 'tv:42', selected_library_id: 3,
    decision_context: { classificationId: 2, capture: { ...row().decision_context.capture, mediaType: 'tv', libraryId: 3 } },
    authorized_snapshot: { ...confirmation().authorized_snapshot, event_key: 'classification_correction:2' } });
  const report = evaluateDestinationOutcomes([row(), tv]);
  expect(report.authorizedOutcomes.cohorts).toMatchObject({
    confirmation: { uniqueDecisions: 1, overall: { completedDecisions: 1, labeledCohortAgreementRate: 1 },
      byMediaType: { tv: { completedAgreement: 1 }, movie: { completedDecisions: 0 } } },
    correction: { uniqueDecisions: 1, overall: { completedDecisions: 1, labeledCohortAgreementRate: 0 },
      byMediaType: { movie: { completedDisagreement: 1 }, tv: { completedDecisions: 0 } } },
  });
  expect(report.limitations.confirmationsMayBeSuggestionBiased).toBe(true);
  expect(readAutomaticDestinationEvaluationReport(report)).toEqual(report);
  const old = structuredClone(report); delete old.authorizedOutcomes.cohorts;
  expect(readAutomaticDestinationEvaluationReport(old)).toBeNull();
});

test('mixed authorized action kinds count once and are excluded from both action-specific rates', () => {
  const report = evaluateDestinationOutcomes([row(), confirmation({ selected_library_id: 2 })]);
  expect(report.uniqueDecisions).toBe(1);
  expect(report.authorizedOutcomes.mixedKindDecisions).toBe(1);
  for (const cohort of Object.values(report.authorizedOutcomes.cohorts)) {
    expect(cohort.uniqueDecisions).toBe(0);
    expect(cohort.overall.labeledCohortAgreementRate).toBeNull();
  }
});

test('cohort stratification keeps contradictory legacy choices visible to all-source conflict rejection', () => {
  const legacy = row({ origin: 'manual_correction', authorized_snapshot: null });
  const report = evaluateDestinationOutcomes([confirmation(), legacy]);
  expect(report.authorizedOutcomes.cohorts.confirmation.overall).toMatchObject({
    conflictingEvidence: 1, completedDecisions: 0, labeledCohortAgreementRate: null,
  });
});

test.each([
  { target_available: false }, { decision_context: null },
])('unavailable or missing-context authorized choices cannot acquire a cohort denominator', overrides => {
  const report = evaluateDestinationOutcomes([confirmation(overrides)]);
  expect(report.authorizedOutcomes.cohorts.confirmation).toMatchObject({ uniqueDecisions: 1,
    overall: { completedDecisions: 0, labeledCohortAgreementRate: null } });
});

test('duplicate authorized aliases supply only one cohort vote', () => {
  const report = evaluateDestinationOutcomes(prepareAuthorizedOutcomeEvaluationRows([confirmation(), confirmation()]));
  expect(report.authorizedOutcomes).toMatchObject({ confirmationRows: 1,
    cohorts: { confirmation: { uniqueDecisions: 1, overall: { completedDecisions: 1 } } } });
});
