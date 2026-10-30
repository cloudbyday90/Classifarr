/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { getPool } from './setup.mjs';
import { livePurposeEvaluationFixture } from '../fixtures/purposeOutcomeFixture.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { applyPolicyManualCorrectionLifecycle } from '../../services/policyManualCorrectionExecutionLifecycle.mjs';
import { policyManualCorrectionLearningService } from '../../services/policyManualCorrectionLearning.mjs';
import { PolicyAuthorizedOutcomeTransactionExecutor } from '../../services/policyAuthorizedOutcomeTransactionExecutor.mjs';
import { captureAuthorizedPurposeOutcome, prunePurposeOutcomeSupplements } from '../../services/purposeOutcomePersistence.mjs';
import { recordFeedbackSource } from '../../services/feedbackSourceReceipt.mjs';
import { PURPOSE_OUTCOME_COHORT_SQL } from '../../services/purposeOutcomeCohortRepository.mjs';
import { buildPurposeOutcomeCohortReport } from '../../services/purposeOutcomeCohortReport.mjs';
import { readBackupConfiguration } from '../../services/backupExportCatalog.mjs';

let client, libraries, history, capture, observed;
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('PRIVATE ORIGINAL','purpose-original','movie',true),('PRIVATE POLICY','purpose-policy','movie',true) RETURNING *`)).rows;
  observed = (await client.query("SELECT transaction_timestamp()-INTERVAL '1 hour' AS at")).rows[0].at;
  capture = structuredClone(livePurposeEvaluationFixture({ libraryId: libraries[1].id }).capture.payload);
  capture.capturedAt = observed.toISOString();
  const decision = buildClassificationDestinationDecision({ metadata: { tmdb_id: 42, media_type: 'movie' },
    method: 'ai_analysis', status: 'completed', libraryId: libraries[0].id });
  history = (await client.query(`INSERT INTO classification_history(title,tmdb_id,media_type,status,method,library_id,metadata)
    VALUES('PRIVATE TITLE',42,'movie','completed','ai_analysis',$1,$2) RETURNING *`,
  [libraries[0].id, { classification_details: { destination_decision: decision } }])).rows[0];
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

async function saveCapture(version = 2) {
  const payload = structuredClone(capture);
  if (version === 1) { payload.version = 'policy_evaluation.v1'; payload.candidates.forEach(row => { delete row.purposeEvidence; }); }
  await client.query(`INSERT INTO classification_policy_evaluation_captures
    (classification_id,capture_version,media_type,identity_key,observed_at,expires_at,reason_id,payload)
    VALUES($1,$2,'movie','movie:42',$3,$3::timestamptz+INTERVAL '720 hours','complete',$4)`, [history.id, version, observed, payload]);
}
async function apply() {
  const changed = await applyPolicyManualCorrectionLifecycle({ client, classificationId: history.id,
    destinationLibraryId: libraries[1].id, actorId: 'purpose-operator' });
  const learning = policyManualCorrectionLearningService.build({ classification: { id: history.id, tmdbId: 42, mediaType: 'movie' },
    destination: { libraryId: libraries[1].id, libraryName: libraries[1].name }, finalOutcomeRecorded: true,
    sourceEventId: changed.sourceEventId, actorId: 'purpose-operator' });
  const executor = new PolicyAuthorizedOutcomeTransactionExecutor({ revalidateAuthorization: async () => ({
    actorTypeId: 'operator', actorId: 'purpose-operator', revalidated: true, canRecordOutcome: true,
    canWriteLearning: false, authorizedSourceIds: ['manual_classification_change'],
  }) });
  const input = { client, intake: learning.intake, learningDecision: learning.decision };
  return { executor, input, result: await executor.execute(input) };
}
const stored = async () => (await client.query('SELECT * FROM policy_purpose_outcome_supplements WHERE classification_id=$1', [history.id])).rows[0];
async function report() {
  const until = new Date((await client.query('SELECT transaction_timestamp() AS at')).rows[0].at.getTime() + 2000).toISOString();
  const since = new Date(Date.parse(until) - 30 * 86400000).toISOString();
  const rows = (await client.query(PURPOSE_OUTCOME_COHORT_SQL, [since, until])).rows.filter(row => row.input !== null).map(row => row.input);
  return buildPurposeOutcomeCohortReport({ rows, observedAt: until, window: { since, until } });
}
async function rejected(sql, params = []) {
  await client.query('SAVEPOINT rejected_write');
  await expect(client.query(sql, params)).rejects.toThrow();
  await client.query('ROLLBACK TO SAVEPOINT rejected_write');
}

test('outcome-only manual choice atomically freezes the policy reference, separate from original automated destination', async () => {
  await saveCapture(); const { result } = await apply();
  expect(result.applied).toBe(true); expect(result.receipt.persistenceStatusId).toBe('outcome_only');
  const row = await stored();
  expect(row).toMatchObject({ source_kind: 'manual', action_reference: 'manual_prior_destination', action_kind: 'correction', reason_id: 'available' });
  expect(row.payload.libraryId).toBe(libraries[1].id);
  expect(row.payload.purposeEvidence).toMatchObject({ origin: 'declared_native', declaredMatch: 'matched', specificity: 'positive_specialized_evidence' });
  expect(row.expires_at.getTime()).toBe(observed.getTime() + 30 * 86400000);
  expect((await report()).cohorts.correction).toEqual({ sampled: 1, agrees: 1, differs: 0 });
  expect(JSON.stringify(await report())).not.toMatch(/PRIVATE|policyId|libraryId|purpose-operator|actorFingerprint/);
  await rejected('UPDATE policy_purpose_outcome_supplements SET payload=$1 WHERE event_key=$2', [{}, row.event_key]);
  await rejected('DELETE FROM policy_purpose_outcome_supplements WHERE event_key=$1', [row.event_key]);
  await rejected('TRUNCATE policy_purpose_outcome_supplements');
});

test('missing-at-commit evidence cannot be filled by late capture, replay or a new tier alias', async () => {
  const { result, executor, input } = await apply(); const before = await stored();
  expect(before.reason_id).toBe('missing_capture');
  await saveCapture();
  expect(await captureAuthorizedPurposeOutcome(client, result.receipt.id)).toBe(false);
  expect((await executor.execute(input)).replayed).toBe(true);
  expect(await stored()).toEqual(before);
  expect((await report()).coverage.gaps.missing_capture).toBe(1);
});

test('immutable v1 stays an explicit gap and arbitrary History card JSON cannot upgrade it', async () => {
  await saveCapture(1);
  await client.query("UPDATE classification_history SET metadata=jsonb_set(metadata,'{forged_purpose}', $1::jsonb) WHERE id=$2",
    [capture.candidates[0].purposeEvidence, history.id]);
  await apply(); expect((await stored()).reason_id).toBe('legacy_capture'); expect((await report()).sampleSize).toBe(0);
});

test('supplement failure rolls back the existing outcome transaction including receipt and choice', async () => {
  await saveCapture();
  await client.query('ALTER TABLE policy_purpose_outcome_supplements ADD CONSTRAINT reject_fixture CHECK(false) NOT VALID');
  await client.query('SAVEPOINT outcome');
  await expect(apply()).rejects.toThrow(); await client.query('ROLLBACK TO SAVEPOINT outcome');
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [history.id])).rows[0].library_id).toBe(libraries[0].id);
  expect((await client.query('SELECT COUNT(*)::int AS n FROM policy_authorized_outcome_source_event_receipts')).rows[0].n).toBe(0);
});

test('explicit feedback review joins its own frozen action meaning; selection-only feedback does not create a supplement', async () => {
  await saveCapture();
  const feedback = (await client.query('INSERT INTO policy_feedback_log(tmdb_id) VALUES(42) RETURNING id')).rows[0].id;
  const reviewId = randomUUID(), fingerprint = 'a'.repeat(64), now = (await client.query('SELECT NOW() AS at')).rows[0].at;
  const snapshot = { version: 'classification.feedback_outcome.v3', classificationId: String(history.id), mediaType: 'movie', tmdbId: 42,
    selectedLibraryId: libraries[1].id, decisionContext: null, action: 'correction', intake: 'standalone', reference: {
      kind: 'original_automated_destination', libraryId: libraries[0].id, reviewId, actorFingerprint: fingerprint,
      sourceVersion: 'b'.repeat(64), issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + 600000).toISOString() } };
  await recordFeedbackSource(client, { classificationId: String(history.id), feedbackId: feedback, intake: 'standalone', fingerprint,
    classification: history, selectedLibraryId: libraries[1].id, reviewEvidence: { snapshot, reviewId, actorFingerprint: fingerprint } });
  expect(await stored()).toMatchObject({ source_kind: 'history_review', action_reference: 'original_automated_destination', reason_id: 'available' });
  expect((await report()).sources.history_review.sampled).toBe(1);
  const exported = await readBackupConfiguration(client);
  expect(JSON.stringify(exported)).not.toContain('purpose_outcome_reference');
  await client.query('DELETE FROM classification_history WHERE id=$1', [history.id]);
  expect(await stored()).toBeUndefined();
});

test('expiry clears copied labels and proof exactly once, retaining a non-rehydratable event tombstone', async () => {
  const receipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('manual_classification_change','classification_correction:999999',$1,$2,$3,'resolved','outcome_only') RETURNING id`,
  ['c'.repeat(64), history.id, libraries[1].id])).rows[0].id;
  await client.query(`INSERT INTO policy_purpose_outcome_supplements
    (event_key,classification_id,authorized_receipt_id,source_kind,action_reference,media_type,identity_key,selected_library_id,
      action_kind,observed_at,frozen_at,expires_at,reason_id,payload)
    VALUES('classification_correction:999999',$1,$2,'manual','manual_prior_destination','movie','movie:42',$3,'correction',
      NOW()-INTERVAL '31 days',NOW()-INTERVAL '31 days',NOW()-INTERVAL '1 day','missing_capture',NULL)`,
  [history.id, receipt, libraries[1].id]);
  expect(await prunePurposeOutcomeSupplements(client)).toBe(1);
  const row = await stored(); expect(row.identity_key).toBeNull(); expect(row.selected_library_id).toBeNull();
  expect(row.action_kind).toBeNull(); expect(row.payload).toBeNull(); expect(row.expired_at).toBeInstanceOf(Date);
  expect(await prunePurposeOutcomeSupplements(client)).toBe(0);
  await rejected("UPDATE policy_purpose_outcome_supplements SET identity_key='movie:42',selected_library_id=$1,action_kind='correction',expired_at=NULL WHERE event_key=$2", [libraries[1].id, row.event_key]);
});

test('NULL cannot bypass the receipt type binding check', async () => {
  const receipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('manual_classification_change','classification_correction:999998',$1,$2,$3,'resolved','outcome_only') RETURNING id`,
  ['c'.repeat(64), history.id, libraries[1].id])).rows[0].id;
  await rejected(`INSERT INTO policy_purpose_outcome_supplements
    (event_key,classification_id,authorized_receipt_id,source_kind,action_reference,media_type,identity_key,selected_library_id,
      action_kind,observed_at,frozen_at,expires_at,reason_id,payload)
    VALUES('feedback_review:'||$1::text,$1,$2,'history_review','original_automated_destination','movie','movie:42',$3,
      'correction',NOW(),NOW(),NOW()+INTERVAL '720 hours','missing_capture',NULL)`, [history.id, receipt, libraries[1].id]);
  expect(await stored()).toBeUndefined();
});

async function runtimeReceipt(alias, destination = libraries[1].id) {
  const fingerprint = 'r'.repeat(22), event = `runtime_resolution:${history.id}:${fingerprint}`;
  const receipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('operator_confirmation',$1,$2,$3,$4,'resolved','outcome_only') RETURNING id,created_at`,
  [`runtime_destination_evidence:${history.id}:${fingerprint}:${alias.repeat(22)}`, 'd'.repeat(64), history.id, destination])).rows[0];
  await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
    VALUES($1,$2,'movie','movie:42',$3,'correction',$4)`, [receipt.id, event, destination, receipt.created_at]);
  return receipt;
}
test('new runtime aliases share one freeze; a contradictory unavailable alias invalidates the whole event', async () => {
  await saveCapture();
  const first = await runtimeReceipt('a'); expect(await captureAuthorizedPurposeOutcome(client, first.id)).toBe(true);
  const before = await stored();
  const second = await runtimeReceipt('b'); expect(await captureAuthorizedPurposeOutcome(client, second.id)).toBe(false);
  expect(await stored()).toEqual(before); expect((await report()).sampleSize).toBe(1);
  const conflict = await runtimeReceipt('c', libraries[0].id);
  expect(await captureAuthorizedPurposeOutcome(client, conflict.id)).toBe(false);
  await client.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0].id]);
  expect((await report()).coverage.gaps.conflicting).toBe(1); expect((await report()).sampleSize).toBe(0);
});

test('an older canonical receipt without supplement cannot acquire proof through a later new tier', async () => {
  await saveCapture(); await runtimeReceipt('a');
  const later = await runtimeReceipt('b'); expect(await captureAuthorizedPurposeOutcome(client, later.id)).toBe(true);
  expect((await stored()).reason_id).toBe('legacy_event');
  expect((await report()).sampleSize).toBe(0);
});
