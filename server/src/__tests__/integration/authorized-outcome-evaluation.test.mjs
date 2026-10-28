/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { applyPolicyManualCorrectionLifecycle } from '../../services/policyManualCorrectionExecutionLifecycle.mjs';
import { policyManualCorrectionLearningService } from '../../services/policyManualCorrectionLearning.mjs';
import { captureAuthorizedOutcomeEvaluation, pruneAuthorizedOutcomeEvaluation } from '../../services/authorizedOutcomeEvaluationCapture.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL, prepareInventoryOutcomeLabels } from '../../services/inventoryOutcomeLabels.mjs';
import { readDestinationOutcomes } from '../../services/destinationOutcomeEvaluationRepository.mjs';
import { buildPolicyRuntimeExactItemMemorySourceEventId } from '../../services/policyRuntimeExactItemMemoryExecutionState.mjs';
import { PolicyRuntimeExactItemMemoryCommandService } from '../../services/policyRuntimeExactItemMemoryCommandService.mjs';
import { buildPolicyRuntimeExactItemMemoryAuthorizationContext } from '../../services/policyRuntimeExactItemMemoryExecutionAuthorization.mjs';
import { inventorySourceDescriptionKey } from '../../services/inventorySourceDescriptionIdentity.mjs';
import { recordClassificationCorrection } from '../../services/classificationCorrectionWriter.mjs';
const { PolicyAuthorizedOutcomeTransactionExecutor } = await import('../../services/policyAuthorizedOutcomeTransactionExecutor.mjs');

let client, libraries;
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('Synthetic A','authorized-a','movie',true),('Synthetic B','authorized-b','movie',true),
    ('Synthetic TV','authorized-tv','tv',true) RETURNING *`)).rows;
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

async function seed(type = 'movie') {
  const capture = buildClassificationDestinationDecision({ metadata: { media_type: type, tmdb_id: 940001 },
    method: 'ai_analysis', status: 'completed', libraryId: libraries[0].id });
  return (await client.query(`INSERT INTO classification_history(title,tmdb_id,media_type,library_id,method,status,metadata)
    VALUES('Synthetic authorized evidence',940001,$1,$2,'ai_analysis','completed',$3) RETURNING *`,
  [type, libraries[0].id, { classification_details: { destination_decision: capture } }])).rows[0];
}

async function apply(row, { destination = libraries[1], learning = true } = {}) {
  const changed = await applyPolicyManualCorrectionLifecycle({ client, classificationId: row.id,
    destinationLibraryId: destination.id, actorId: 'synthetic-operator' });
  const admission = policyManualCorrectionLearningService.build({ classification: { id: row.id, tmdbId: row.tmdb_id, mediaType: row.media_type },
    destination: { libraryId: destination.id, libraryName: destination.name }, finalOutcomeRecorded: true,
    sourceEventId: changed.sourceEventId, actorId: 'synthetic-operator' });
  const executor = new PolicyAuthorizedOutcomeTransactionExecutor({ revalidateAuthorization: async () => ({
    actorTypeId: 'operator', actorId: 'synthetic-operator', revalidated: true, canRecordOutcome: true,
    canWriteLearning: learning, authorizedSourceIds: ['manual_classification_change'],
  }) });
  const input = { client, intake: admission.intake, learningDecision: admission.decision };
  const result = await executor.execute(input);
  return { executor, input, result };
}

async function labels() { return (await client.query(INVENTORY_OUTCOME_LABEL_SQL)).rows; }
async function snapshots() { return (await client.query('SELECT * FROM policy_authorized_outcome_evaluation_snapshots')).rows; }

test.each([true, false])('freezes an authorized choice atomically and deduplicates manual aliases with learning=%s', async learning => {
  const row = await seed(); const { result } = await apply(row, { learning });
  expect(result.applied).toBe(true);
  const [snapshot] = await snapshots();
  expect(snapshot).toMatchObject({ media_type: 'movie', identity_key: 'movie:940001', action_kind: 'correction', selected_library_id: libraries[1].id });
  expect(snapshot.decision_context.capture.method).toBe('ai_analysis');
  expect(Object.keys(snapshot).sort()).toEqual(['receipt_id', 'snapshot_version', 'event_key', 'media_type', 'identity_key',
    'selected_library_id', 'action_kind', 'decision_context', 'observed_at'].sort());
  const rows = await labels();
  expect(rows).toHaveLength(1); expect(rows[0].origin).toBe('authorized_outcome');
  const prepared = prepareInventoryOutcomeLabels(rows, [{ key: 'movie:940001', libraryIds: [libraries[0].id] }], libraries);
  expect(prepared.coverage).toMatchObject({ eligibleRows: 1, authorizedCorrectionRows: 1, corrections: 1 });
  expect((await readDestinationOutcomes(client)).overall.completedDisagreement).toBe(1);
  const receipt = (await client.query('SELECT * FROM policy_authorized_outcome_source_event_receipts')).rows[0];
  expect(receipt.persistence_status_id).toBe(learning ? 'ready' : 'outcome_only');
});

test('same-destination manual choice is a confirmation, not a fabricated correction', async () => {
  const row = await seed(); await apply(row, { destination: libraries[0], learning: false });
  expect((await snapshots())[0].action_kind).toBe('confirmation');
  expect((await readDestinationOutcomes(client))).toMatchObject({ authorizedOutcomes: { confirmationRows: 1, correctionRows: 0 },
    overall: { completedAgreement: 1 } });
});

test.each([true, false])('source-only outcome-only capture requires an exact pointer, matches=%s', async matches => {
  const server = (await client.query(`INSERT INTO media_server(type,name,url,api_key)
    VALUES('plex','Synthetic source','http://unused.invalid','synthetic') RETURNING id`)).rows[0].id;
  const item = (await client.query(`INSERT INTO media_server_items(media_server_id,library_id,external_id,title,media_type)
    VALUES($1,$2,'source-only','Synthetic authorized evidence','movie') RETURNING *`, [server, libraries[0].id])).rows[0];
  const row = await seed();
  row.tmdb_id = null;
  await client.query("UPDATE classification_history SET tmdb_id=NULL,method='source_library',metadata=$2 WHERE id=$1",
    [row.id, { itemId: item.id, source_library_id: matches ? item.library_id : libraries[1].id }]);
  const { result } = await apply(row, { learning: false });
  expect(result.applied).toBe(true);
  if (!matches) {
    expect(await snapshots()).toHaveLength(0);
    expect((await labels())[0].authorized_snapshot.snapshot_missing).toBe(true);
    return;
  }
  const [snapshot] = await snapshots();
  expect(snapshot.identity_key).toBe(inventorySourceDescriptionKey(item));
  expect(snapshot.decision_context).toBeNull();
  const rows = await labels(); expect(rows).toHaveLength(1); expect(rows[0].tmdb_id).toBeNull();
  await client.query('UPDATE classification_history SET tmdb_id=940002 WHERE id=$1', [row.id]);
  expect(prepareInventoryOutcomeLabels(await labels(), [{ key: 'movie:940002', libraryIds: [libraries[1].id] }], libraries).labels.size).toBe(0);
});

test.each(['confirm_destination', 'change_destination'])('runtime %s freezes the original classifier context after history method changes', async actionId => {
  const row = await seed();
  const observedAt = (await client.query('SELECT transaction_timestamp() AS observed_at')).rows[0].observed_at.toISOString();
  const metadata = { ...row.metadata, classification_details: { ...row.metadata.classification_details, outcome_link: {
    type: 'resolved', source: 'policy_question', final_library_id: libraries[1].id, final_library_name: libraries[1].name,
    runtime_question_answer: { action_id: actionId, contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'abcdefghijklmnopqrstuv', destination_library_id: libraries[1].id, evaluation_observed_at: observedAt },
  } } };
  await client.query(`UPDATE classification_history SET method='manual_classification',status='routed',library_id=$2,library_name=$3,metadata=$4 WHERE id=$1`,
    [row.id, libraries[1].id, libraries[1].name, metadata]);
  const service = new PolicyRuntimeExactItemMemoryCommandService({ db: { withTransaction: callback => callback(client) } });
  await service.execute({ classificationId: row.id, actorId: 'synthetic-operator',
    authorizationContext: buildPolicyRuntimeExactItemMemoryAuthorizationContext({ actorId: 'synthetic-operator', authenticated: true }) });
  const [snapshot] = await snapshots();
  expect(snapshot.action_kind).toBe(actionId === 'change_destination' ? 'correction' : 'confirmation');
  expect(snapshot.decision_context.capture.method).toBe('ai_analysis');
  expect(snapshot.event_key).toBe(`runtime_resolution:${row.id}:abcdefghijklmnopqrstuv`);
  expect(snapshot.observed_at.toISOString()).toBe(observedAt);
  expect(buildPolicyRuntimeExactItemMemorySourceEventId({ classificationId: row.id, contractFingerprint: 'abcdefghijklmnopqrstuv' })).toBeTruthy();
});

test.each(['expired', 'missing', 'future'])('a delayed first exact-item alias cannot renew %s resolution evidence', async kind => {
  const row = await seed();
  const clock = (await client.query('SELECT transaction_timestamp() AS current, transaction_timestamp() - INTERVAL \'31 days\' AS old')).rows[0];
  const observedAt = kind === 'expired' ? clock.old.toISOString() : kind === 'future'
    ? new Date(clock.current.getTime() + 86400000).toISOString() : undefined;
  const metadata = { ...row.metadata, classification_details: { ...row.metadata.classification_details, outcome_link: {
    type: 'resolved', source: 'policy_question', final_library_id: libraries[1].id, final_library_name: libraries[1].name,
    runtime_question_answer: { action_id: 'confirm_destination', contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: 'abcdefghijklmnopqrstuv', destination_library_id: libraries[1].id, evaluation_observed_at: observedAt },
  } } };
  await client.query("UPDATE classification_history SET method='manual_classification',status='routed',library_id=$2,library_name=$3,metadata=$4 WHERE id=$1",
    [row.id, libraries[1].id, libraries[1].name, metadata]);
  if (kind === 'expired') {
    const oldReceipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
      (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id,learning_tier_id,created_at)
      VALUES('operator_confirmation',$1,$2,$3,$4,'resolved','ready','compatibility_evidence',$5) RETURNING id`,
    [`runtime_destination_evidence:${row.id}:abcdefghijklmnopqrstuv:abcdefghijklmnopqrstuv`, 'c'.repeat(64), row.id, libraries[1].id, clock.old])).rows[0];
    await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
      (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
      VALUES($1,$2,'movie','movie:940001',$3,'confirmation',$4)`,
    [oldReceipt.id, `runtime_resolution:${row.id}:abcdefghijklmnopqrstuv`, libraries[1].id, clock.old]);
    expect(await pruneAuthorizedOutcomeEvaluation(client)).toBe(1);
  }
  const service = new PolicyRuntimeExactItemMemoryCommandService({ db: { withTransaction: callback => callback(client) } });
  const result = await service.execute({ classificationId: row.id, actorId: 'synthetic-operator',
    authorizationContext: buildPolicyRuntimeExactItemMemoryAuthorizationContext({ actorId: 'synthetic-operator', authenticated: true }) });
  expect(result.execution.applied).toBe(true);
  expect(await snapshots()).toHaveLength(0);
  expect((await labels())[0].authorized_snapshot.snapshot_missing).toBe(true);
  expect((await client.query("SELECT id FROM classification_evidence WHERE scope='item_exact' AND tmdb_id=940001")).rows).toHaveLength(1);
});

test('snapshot insert failure rolls back receipt, history, correction and learning effects', async () => {
  const row = await seed(); await client.query('SAVEPOINT atomic_capture');
  await client.query('ALTER TABLE policy_authorized_outcome_evaluation_snapshots ADD CONSTRAINT synthetic_capture_failure CHECK(false)');
  await expect(apply(row)).rejects.toMatchObject({ code: '23514' });
  await client.query('ROLLBACK TO SAVEPOINT atomic_capture');
  expect(await snapshots()).toHaveLength(0);
  expect((await client.query('SELECT * FROM policy_authorized_outcome_source_event_receipts')).rows).toHaveLength(0);
  expect((await client.query('SELECT * FROM classification_corrections')).rows).toHaveLength(0);
  expect((await client.query("SELECT * FROM classification_evidence WHERE scope='item_exact' AND tmdb_id=940001 AND media_type='movie'")).rows).toHaveLength(0);
  expect((await client.query('SELECT library_id FROM classification_history WHERE id=$1', [row.id])).rows[0].library_id).toBe(row.library_id);
});

test('exact replay neither duplicates nor resurrects deleted evidence', async () => {
  const row = await seed(); const { executor, input } = await apply(row);
  const [before] = await snapshots();
  expect((await executor.execute(input)).replayed).toBe(true);
  expect(await snapshots()).toEqual([before]);
  await client.query('DELETE FROM policy_authorized_outcome_evaluation_snapshots');
  expect((await executor.execute(input)).replayed).toBe(true);
  expect(await snapshots()).toHaveLength(0);
  expect((await labels()).some(value => value.authorized_snapshot?.snapshot_missing)).toBe(true);
});

test('history/event deletion cannot rewrite a frozen identity; destination deletion cascades only evidence', async () => {
  const row = await seed(); await apply(row);
  await client.query('DELETE FROM classification_corrections');
  await client.query('DELETE FROM classification_history');
  expect((await labels())[0].identity_key).toBe('movie:940001');
  await client.query('DELETE FROM libraries WHERE id=$1', [libraries[1].id]);
  expect(await snapshots()).toHaveLength(0);
  expect((await client.query('SELECT * FROM policy_authorized_outcome_source_event_receipts')).rows).toHaveLength(1);
});

test('snapshot update is rejected and replace-restore deletion cascades transactionally', async () => {
  await apply(await seed()); await client.query('SAVEPOINT immutable_snapshot');
  await expect(client.query("UPDATE policy_authorized_outcome_evaluation_snapshots SET action_kind='confirmation'")).rejects.toThrow('cannot be updated');
  await client.query('ROLLBACK TO SAVEPOINT immutable_snapshot');
  await client.query('SAVEPOINT replace_restore');
  await client.query("SET LOCAL classifarr.policy_authorized_outcome_receipt_maintenance='replace_restore'");
  await client.query('DELETE FROM policy_authorized_outcome_source_event_receipts');
  expect(await snapshots()).toHaveLength(0);
  await client.query('ROLLBACK TO SAVEPOINT replace_restore');
  expect(await snapshots()).toHaveLength(1);
});

test('historical receipts report gaps without a current history identity join', async () => {
  const row = await seed();
  await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('operator_confirmation','legacy-fixture',$1,$2,$3,'resolved','outcome_only')`, ['a'.repeat(64), row.id, libraries[1].id]);
  const rows = await labels(); expect(rows).toHaveLength(1); expect(rows[0].identity_key).toBeNull();
  expect(prepareInventoryOutcomeLabels(rows, [{ key: 'movie:940001', libraryIds: [libraries[0].id] }], libraries).coverage)
    .toMatchObject({ eligibleRows: 0, authorizedMissingSnapshotRows: 1, labeledIdentities: 0 });
  expect(await readDestinationOutcomes(client)).toMatchObject({ authorizedOutcomes: { missingSnapshotRows: 1 },
    overall: { completedDecisions: 0, labeledCohortAgreementRate: null } });
});

test.each(['destination', 'event'])('corrupt %s binding fails the report instead of falling back to a legacy label', async field => {
  await apply(await seed()); const [snapshot] = await snapshots();
  await client.query('DELETE FROM policy_authorized_outcome_evaluation_snapshots');
  await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,decision_context,observed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [snapshot.receipt_id,
    field === 'event' ? 'classification_correction:999999999' : snapshot.event_key,
    snapshot.media_type, snapshot.identity_key, field === 'destination' ? libraries[0].id : snapshot.selected_library_id,
    snapshot.action_kind, snapshot.decision_context, snapshot.observed_at]);
  const rows = await labels(); expect(rows).toHaveLength(1);
  expect(() => prepareInventoryOutcomeLabels(rows, [{ key: 'movie:940001', libraryIds: [libraries[0].id] }], libraries))
    .toThrow('authorized_evaluation_invalid_snapshot');
  await expect(readDestinationOutcomes(client)).rejects.toThrow('authorized_evaluation_invalid_snapshot');
});

test('fixed retention removes old snapshots while preserving receipt replay guards', async () => {
  const row = await seed(); await apply(row);
  const futureClock = { query: (sql, parameters) => client.query(sql.replaceAll('NOW()', "(NOW() + INTERVAL '31 days')"), parameters) };
  expect(await pruneAuthorizedOutcomeEvaluation(futureClock)).toBe(1);
  expect(await snapshots()).toHaveLength(0);
  expect((await client.query('SELECT * FROM policy_authorized_outcome_source_event_receipts')).rows).toHaveLength(1);
});

test('inactive or wrong-type target evidence cannot turn a contradiction into a label', async () => {
  const row = await seed(); await apply(row);
  await client.query("UPDATE libraries SET media_type='tv',is_active=false WHERE id=$1", [libraries[1].id]);
  const rows = await labels(); expect(rows).toHaveLength(1); expect(rows[0].target_available).toBe(false);
  expect(prepareInventoryOutcomeLabels(rows, [{ key: 'movie:940001', libraryIds: [libraries[0].id] }], libraries).labels.size).toBe(0);
  expect((await readDestinationOutcomes(client)).overall.unavailableDestination).toBe(1);
});

test('mixed authorized and legacy corrections retain unavailable contradictions before grouping', async () => {
  await apply(await seed());
  const other = await seed();
  const unavailable = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('Synthetic unavailable','authorized-unavailable','movie',true) RETURNING *`)).rows[0];
  await recordClassificationCorrection(client, { classification: other, originalLibraryId: libraries[0].id,
    destinationLibraryId: unavailable.id, correctedBy: 'synthetic-operator' });
  await client.query('UPDATE libraries SET is_active=false WHERE id=$1', [unavailable.id]);
  const rows = await labels();
  expect(rows).toHaveLength(2);
  expect(rows.find(value => value.origin === 'manual_correction').target_available).toBe(false);
  const result = prepareInventoryOutcomeLabels(rows, [{ key: 'movie:940001', libraryIds: [libraries[0].id] }], libraries);
  expect(result.labels.size).toBe(0); expect(result.coverage.conflictingIdentities).toBe(1);
});

test('automatic and failed outcome receipts never enter either evaluation population', async () => {
  const row = await seed();
  for (const [source, status] of [['arr_routing_outcome', 'routed'], ['operator_confirmation', 'route_failed_missing_mapping']]) {
    await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
      (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
      VALUES($1,$2,$3,$4,$5,$6,'outcome_only')`, [source, `${source}:${status}`, 'b'.repeat(64), row.id, libraries[1].id, status]);
  }
  expect(await labels()).toHaveLength(0);
  expect((await readDestinationOutcomes(client)).status).toBe('no_eligible_outcomes');
  expect(await captureAuthorizedOutcomeEvaluation({ client, command: { sourceId: 'arr_routing_outcome', finalOutcome: { status: 'routed' } },
    executionState: {}, receipt: { id: '1' } })).toBe(false);
});
