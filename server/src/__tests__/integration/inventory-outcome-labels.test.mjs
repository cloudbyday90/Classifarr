/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import { getPool } from './setup.mjs';
import { INVENTORY_OUTCOME_LABEL_SQL } from '../../services/inventoryOutcomeLabels.mjs';

let db, selectedId, candidateId, policyId, historyId;

beforeEach(async () => {
  db = getPool();
  [selectedId, candidateId] = (await db.query(`INSERT INTO libraries(name,external_id,media_type)
    VALUES('Outcome selected','outcome-selected-test','movie'),('Outcome candidate','outcome-candidate-test','movie') RETURNING id`)).rows.map(row => row.id);
  policyId = (await db.query("INSERT INTO library_policies(library_id,name) VALUES($1,'Outcome benchmark') RETURNING id", [selectedId])).rows[0].id;
});

afterEach(async () => {
  if (historyId) {
    await db.query('DELETE FROM classification_corrections WHERE classification_id=$1', [historyId]);
    await db.query('DELETE FROM classification_history WHERE id=$1', [historyId]);
    historyId = null;
  }
  await db.query('DELETE FROM policy_feedback_log WHERE selected_policy_id=$1', [policyId]);
  await db.query('DELETE FROM library_policies WHERE id=$1', [policyId]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [[selectedId, candidateId]]);
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
