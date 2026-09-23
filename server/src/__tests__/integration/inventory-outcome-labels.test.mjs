/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from '../../services/inventoryOutcomeLabels.mjs';
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from '../../services/inventoryProspectiveOutcomeRepository.mjs';
import { INVENTORY_PROSPECTIVE_ACTIVITY_SQL } from '../../services/inventoryProspectiveActivityRepository.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';

let db, selectedId, candidateId, policyId, historyId;

beforeEach(async () => {
  db = getPool();
  [selectedId, candidateId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Outcome selected','outcome-selected-test','movie'),('Outcome candidate','outcome-candidate-test','movie') RETURNING id`)).rows.map(row => row.id);
  policyId = (await db.query("INSERT INTO library_policies(library_id,name) VALUES($1,'Outcome benchmark') RETURNING id", [selectedId])).rows[0].id;
});

afterEach(async () => {
  await db.query(`DELETE FROM policy_feedback_sources WHERE feedback_id IN
    (SELECT id FROM policy_feedback_log WHERE selected_policy_id=$1)`, [policyId]);
  if (historyId) {
    await db.query('DELETE FROM classification_corrections WHERE classification_id=$1', [historyId]);
    await db.query('DELETE FROM classification_history WHERE id=$1', [historyId]);
    historyId = null;
  }
  await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=$1', [policyId]);
  await db.query('DELETE FROM library_policies WHERE id=$1', [policyId]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[selectedId, candidateId]]);
});

test('bounded activity count uses the same exclusive window and movie/TV scope', async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE classification_history (recorded_at timestamptz, media_type text) ON COMMIT DROP');
    await client.query(`INSERT INTO classification_history(recorded_at, media_type) VALUES
      ('2026-09-23T00:00:00Z','movie'), ('2026-09-23T12:00:00Z','tv'),
      ('2026-09-24T00:00:00Z','movie'), ('2026-09-23T12:00:00Z','other')`);
    const window = ['2026-09-23T00:00:00Z', '2026-09-24T00:00:00Z'];
    expect((await client.query(INVENTORY_PROSPECTIVE_ACTIVITY_SQL, window)).rows[0])
      .toEqual({ recorded_movie_tv_events: 2 });
    await client.query(`INSERT INTO classification_history(recorded_at, media_type)
      SELECT '2026-09-23T12:00:00Z', 'movie' FROM generate_series(1, 5002)`);
    expect((await client.query(INVENTORY_PROSPECTIVE_ACTIVITY_SQL, window)).rows[0])
      .toEqual({ recorded_movie_tv_events: 5001 });
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
});

test('prospective SQL binds delayed outcomes to exact history, never a same-identity neighbor or current placement', async () => {
  const capture = structuredClone(inventoryRankingShadowFixture().capture);
  capture.candidates[0].libraryId = candidateId;
  capture.candidates[1].libraryId = selectedId;
  capture.baselineLibraryId = candidateId; capture.combinedLibraryId = selectedId;
  historyId = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status,metadata,recorded_at)
    VALUES(900005,'movie','Prospective item',$1,'awaiting_decision',$2,$3) RETURNING id`,
  [candidateId, { classification_details: { inventory_ranking_shadow: capture } }, capture.capturedAt])).rows[0].id;
  const feedbackIds = (await db.query(`INSERT INTO policy_feedback_log(tmdb_id,media_type,selected_policy_id,selected_library_id,
    top_suggestion_library_id,was_correction,prompted_at,responded_at)
    VALUES (900005,'movie',$1,$2,$3,true,NOW(),NOW()),
      (900005,'movie',$1,$2,$3,true,NOW(),NOW()) RETURNING id`, [policyId, selectedId, candidateId])).rows.map(row => row.id);
  await db.query(`INSERT INTO policy_feedback_sources(classification_id,feedback_id,intake,request_fingerprint)
    VALUES($1,$2,'prompt',$3),($4,$5,'prompt',$3)`,
  [historyId, feedbackIds[0], 'a'.repeat(64), historyId + 999999, feedbackIds[1]]);
  const read = async () => (await db.query(INVENTORY_PROSPECTIVE_OUTCOME_SQL,
    ['2000-01-01T00:00:00Z', '2999-01-01T00:00:00Z'])).rows.filter(row => row.classification_id === historyId);
  const rows = await read();
  expect(rows).toHaveLength(1);
  expect(rows[0].outcomes).toHaveLength(1);
  expect(evaluateInventoryProspectiveOutcomes(rows).media.movie).toMatchObject({ sampled: 1, gains: 1 });
  await db.query("UPDATE policy_feedback_log SET responded_at='2000-01-01' WHERE id=$1", [feedbackIds[0]]);
  expect((await read())[0].outcomes).toEqual([]);
  await db.query(`INSERT INTO classification_corrections(classification_id,original_library_id,corrected_library_id,corrected_by)
    VALUES($1,$2,$3,'test-user')`, [historyId, candidateId, selectedId]);
  // The old history placement is intentionally unchanged: a pending move must not remove the label.
  expect(evaluateInventoryProspectiveOutcomes(await read()).media.movie).toMatchObject({ sampled: 1, corrections: 1, gains: 1 });
});

test('read-only label selection admits feedback and manual corrections, excluding unknown and contradictory rows', async () => {
  await db.query(`INSERT INTO policy_feedback_log(tmdb_id,media_type,selected_policy_id,selected_library_id,
    top_suggestion_library_id,was_correction,prompted_at,responded_at)
    VALUES (900001,'movie',$1,$2,$3,true,NOW()-INTERVAL '1 hour',NOW()),
      (900002,'movie',$1,$2,$3,true,NOW()-INTERVAL '1 hour',NULL),
      (900003,'movie',$1,$2,$2,true,NOW()-INTERVAL '1 hour',NOW())`, [policyId, selectedId, candidateId]);
  historyId = (await db.query(`INSERT INTO classification_history(tmdb_id,media_type,title,library_id,status)
    VALUES(900004,'movie','Outcome test item',$1,'corrected') RETURNING id`, [selectedId])).rows[0].id;
  await db.query(`INSERT INTO classification_corrections(classification_id,original_library_id,corrected_library_id,corrected_by)
    VALUES($1,$2,$3,'test-user')`, [historyId, candidateId, selectedId]);
  const result = await db.query(INVENTORY_OUTCOME_LABEL_SQL);
  const own = result.rows.filter(row => [900001, 900002, 900003, 900004].includes(row.tmdb_id));
  expect(own).toEqual(expect.arrayContaining([
    { media_type: 'movie', tmdb_id: 900001, selected_library_id: selectedId,
      was_correction: true, origin: 'feedback' },
    { media_type: 'movie', tmdb_id: 900004, selected_library_id: selectedId,
      was_correction: true, origin: 'manual_correction' },
  ]));
  expect(own).toHaveLength(2);
});
