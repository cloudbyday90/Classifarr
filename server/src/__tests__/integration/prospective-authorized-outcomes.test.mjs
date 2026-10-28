/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from '../../services/inventoryProspectiveOutcomeRepository.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { recordClassificationCorrection } from '../../services/classificationCorrectionWriter.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';

let client, libraries, history;
beforeEach(async () => {
  client = await getPool().connect(); await client.query('BEGIN');
  libraries = (await client.query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES('Prospective A','prospective-a','movie',true),('Prospective B','prospective-b','movie',true) RETURNING *`)).rows;
  const capture = structuredClone(inventoryRankingShadowFixture('movie', 950001).capture);
  capture.capturedAt = new Date(Date.now() - 60000).toISOString();
  capture.candidates.forEach((candidate, i) => { candidate.libraryId = libraries[i].id; });
  capture.baselineLibraryId = libraries[0].id; capture.combinedLibraryId = libraries[1].id;
  history = (await client.query(`INSERT INTO classification_history(title,tmdb_id,media_type,metadata,recorded_at,library_id)
    VALUES('Synthetic prospective item',950001,'movie',$1,$2,$3) RETURNING *`,
  [{ classification_details: { inventory_ranking_shadow: capture } }, capture.capturedAt, libraries[0].id])).rows[0];
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });

async function captureOutcome({ resolution = 'a'.repeat(22), alias = 'b'.repeat(22), destination = libraries[1].id,
  kind = 'correction', identity = 'movie:950001', observedAt = null, snapshot = true } = {}) {
  const receipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('operator_confirmation',$1,$2,$3,$4,'resolved','outcome_only') RETURNING *`,
  [`runtime_destination_evidence:${history.id}:${resolution}:${alias}`, 'c'.repeat(64), history.id, destination])).rows[0];
  if (snapshot) await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
    VALUES($1,$2,'movie',$3,$4,$5,$6)`,
  [receipt.id, `runtime_resolution:${history.id}:${resolution}`, identity, destination, kind, observedAt ?? receipt.created_at]);
  return receipt;
}
async function read() {
  return (await client.query(INVENTORY_PROSPECTIVE_OUTCOME_SQL,
    ['2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z'])).rows.filter(row => row.classification_id === history.id);
}
async function report() { return evaluateInventoryProspectiveOutcomes(await read()); }

test('canonical-only outcome scores the exact frozen comparison and survives later history identity drift only as a holdout', async () => {
  await captureOutcome();
  expect(await report()).toMatchObject({ sampleSize: 1, kinds: { correction: { gains: 1 } }, promotionAllowed: false });
  await client.query('UPDATE classification_history SET tmdb_id=950002 WHERE id=$1', [history.id]);
  expect(await report()).toMatchObject({ sampleSize: 0, coverage: { identityMismatchCaptures: 1 } });
});

test('BIGINT history identifiers retain exact nested JSON bindings', async () => {
  history = (await client.query('UPDATE classification_history SET id=9223372036854775807 WHERE id=$1 RETURNING *', [history.id])).rows[0];
  await captureOutcome();
  expect((await read())[0].outcomes[0].classification_id).toBe('9223372036854775807');
  expect((await report()).sampleSize).toBe(1);
});

test('tier aliases deduplicate before the observation sentinel', async () => {
  for (let n = 0; n < 102; n++) await captureOutcome({ alias: n.toString().padStart(22, 'b') });
  expect((await read())[0].outcomes).toHaveLength(1);
  expect((await report()).sampleSize).toBe(1);
});

test('100 distinct observations are admitted, while 101 invalidate the capture without a partial metric', async () => {
  for (let n = 0; n < 100; n++) await captureOutcome({ resolution: n.toString().padStart(22, 'a') });
  expect((await report()).sampleSize).toBe(1);
  await captureOutcome({ resolution: 'z'.repeat(22) });
  expect(await report()).toMatchObject({ sampleSize: 0, coverage: { invalid: 1 } });
});

test('authorized manual capture suppresses the retained correction and raw aliases', async () => {
  const correction = await recordClassificationCorrection(client, { classification: history,
    originalLibraryId: libraries[0].id, destinationLibraryId: libraries[1].id, correctedBy: 'synthetic-operator' });
  const receipt = (await client.query(`INSERT INTO policy_authorized_outcome_source_event_receipts
    (source_id,source_event_id,command_fingerprint,classification_id,destination_library_id,final_outcome_status_id,persistence_status_id)
    VALUES('manual_classification_change',$1,$2,$3,$4,'resolved','outcome_only') RETURNING *`,
  [`classification_correction:${correction.id}`, 'd'.repeat(64), history.id, libraries[1].id])).rows[0];
  await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
    SELECT r.id,$2,'movie','movie:950001',$3,'correction',r.created_at
    FROM policy_authorized_outcome_source_event_receipts r WHERE r.id=$1`,
  [receipt.id, receipt.source_event_id, libraries[1].id]);
  expect((await read())[0].outcomes).toHaveLength(1);
  expect((await report()).sampleSize).toBe(1);
});

test('unavailable retained contradiction remains visible beside a favorable authorized choice', async () => {
  await captureOutcome();
  await recordClassificationCorrection(client, { classification: history,
    originalLibraryId: libraries[1].id, destinationLibraryId: libraries[0].id, correctedBy: 'synthetic-operator' });
  await client.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0].id]);
  expect(await report()).toMatchObject({ sampleSize: 0, coverage: { conflicting: 1, unavailableOutcomeRows: 1 } });
});

test.each(['missing', 'expired', 'pre_capture', 'source_only'])('%s evidence cannot be refreshed into a favorable label', async mode => {
  const options = mode === 'missing' ? { snapshot: false }
    : mode === 'expired' ? { observedAt: new Date(Date.now() - 31 * 86400000) }
      : mode === 'pre_capture' ? { observedAt: new Date(Date.now() - 3600000) }
        : { identity: `source:${'a'.repeat(64)}` };
  await captureOutcome(options);
  expect((await report()).sampleSize).toBe(0);
});

test('mixed kinds are excluded after all-source grouping, without inferring action from the selected library', async () => {
  await captureOutcome(); await captureOutcome({ resolution: 'b'.repeat(22), kind: 'confirmation' });
  expect(await report()).toMatchObject({ sampleSize: 0, coverage: { mixedKinds: 1 } });
});

test('corrupt canonical receipt bindings fail the read', async () => {
  const receipt = await captureOutcome();
  await client.query('DELETE FROM policy_authorized_outcome_evaluation_snapshots WHERE receipt_id=$1', [receipt.id]);
  await client.query(`INSERT INTO policy_authorized_outcome_evaluation_snapshots
    (receipt_id,event_key,media_type,identity_key,selected_library_id,action_kind,observed_at)
    VALUES($1,$2,'movie','movie:950001',$3,'correction',$4)`,
  [receipt.id, `runtime_resolution:${history.id}:${'a'.repeat(22)}`, libraries[0].id, receipt.created_at]);
  await expect(report()).rejects.toThrow('invalid_snapshot');
});

test.each([true, false])('deleted correction event retains context-bound evidence, with context=%s', async withContext => {
  const decision = buildClassificationDestinationDecision({ metadata: history, method: 'ai_analysis', status: 'completed', libraryId: libraries[0].id });
  const classification = withContext ? { ...history, method: 'ai_analysis',
    metadata: { classification_details: { destination_decision: decision } } } : history;
  const correction = await recordClassificationCorrection(client, { classification, originalLibraryId: libraries[0].id,
    destinationLibraryId: libraries[1].id, correctedBy: 'synthetic-operator' });
  await client.query('DELETE FROM classification_corrections WHERE id=$1', [correction.id]);
  expect((await report()).sampleSize).toBe(withContext ? 1 : 0);
  if (!withContext) expect((await report()).coverage.unverifiedOutcomeRows).toBe(1);
});

test('correction event and frozen context class disagreement fail closed', async () => {
  const correction = await recordClassificationCorrection(client, { classification: history,
    originalLibraryId: libraries[0].id, destinationLibraryId: libraries[1].id, correctedBy: 'synthetic-operator' });
  const context = { classificationId: Number(history.id) + 1,
    capture: buildClassificationDestinationDecision({ metadata: history, method: 'ai_analysis', status: 'completed', libraryId: libraries[0].id }) };
  await client.query('UPDATE classification_correction_outcomes SET decision_context=$1 WHERE correction_id=$2', [context, correction.id]);
  await expect(report()).rejects.toThrow('invalid_evidence');
});

test.each([false, true])('legacy feedback remains non-scoring with frozen snapshot=%s', async frozen => {
  await captureOutcome();
  const snapshot = frozen ? { version: 'classification.feedback_outcome.v1', mediaType: 'movie', tmdbId: 950001,
    selectedLibraryId: libraries[1].id, decisionContext: null } : null;
  await client.query(`INSERT INTO policy_feedback_sources(classification_id,feedback_id,intake,request_fingerprint,outcome_snapshot)
    VALUES($1,NULL,'standalone',$2,$3)`, [history.id, 'e'.repeat(64), snapshot]);
  const result = await report();
  expect(result.sampleSize).toBe(0);
  expect(result.coverage[frozen ? 'unknownKindRows' : 'missingSnapshotRows']).toBe(1);
});

test('observation overflow keeps the earliest comparison reserved against a favorable retry', async () => {
  const first = history;
  for (let n = 0; n < 101; n++) await captureOutcome({ resolution: n.toString().padStart(22, 'a') });
  history = (await client.query(`INSERT INTO classification_history(title,tmdb_id,media_type,metadata,recorded_at,library_id)
    VALUES('Synthetic retry',950001,'movie',$1,$2,$3) RETURNING *`,
  [first.metadata, new Date(first.recorded_at.getTime() + 1), libraries[0].id])).rows[0];
  await captureOutcome();
  const rows = (await client.query(INVENTORY_PROSPECTIVE_OUTCOME_SQL,
    ['2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z'])).rows.filter(row => [first.id, history.id].includes(row.classification_id));
  expect(evaluateInventoryProspectiveOutcomes(rows)).toMatchObject({ sampleSize: 0,
    coverage: { invalid: 1, duplicateIdentityOrDescription: 1 } });
});
