/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, afterEach, test, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createFeedbackRouter } from '../../routes/feedbackRouteShared.mjs';
import { FeedbackAnalysis } from '../../services/feedbackAnalysis.mjs';
import { errorHandler } from '../../middleware/errorHandler.mjs';
import { buildClassificationDestinationDecision } from '../../services/classificationDestinationDecision.mjs';
import { inventoryRankingShadowFixture } from '../fixtures/inventoryRankingShadowFixture.mjs';
import { INVENTORY_PROSPECTIVE_OUTCOME_SQL } from '../../services/inventoryProspectiveOutcomeRepository.mjs';
import { evaluateInventoryProspectiveOutcomes } from '../../services/inventoryProspectiveOutcomes.mjs';
import { pruneFeedbackReviewReferences, resetFeedbackReviewReferences } from '../../services/feedbackReviewMaintenance.mjs';
import { recreateFeedbackReceiptAt } from '../helpers/feedbackReceiptClockFixture.mjs';
import { pruneFeedbackOutcomeSnapshots } from '../../services/feedbackOutcomeSnapshot.mjs';

let db, app, actor, otherActor, classId, libraries, policies;
beforeEach(async () => {
  db = createIntegrationDatabaseModuleMock();
  [actor, otherActor] = (await db.query(`INSERT INTO users(username,password_hash,role) VALUES
    ('review-owner','synthetic','admin'),('review-other','synthetic','admin') RETURNING id`)).rows.map(row => row.id);
  libraries = (await db.query(`INSERT INTO libraries(name,external_id,media_type,is_active) VALUES
    ('Original','feedback-review-a','movie',true),('Shortlist','feedback-review-b','movie',true) RETURNING id`)).rows.map(row => row.id);
  policies = (await db.query(`INSERT INTO library_policies(library_id,name) VALUES($1,'Original policy'),($2,'Shortlist policy') RETURNING id`, libraries)).rows.map(row => row.id);
  const capture = buildClassificationDestinationDecision({ metadata: { media_type: 'movie', tmdb_id: 603 }, method: 'policy_auto', status: 'completed', libraryId: libraries[0] });
  const ranking = structuredClone(inventoryRankingShadowFixture('movie', 603).capture);
  ranking.capturedAt = new Date(Date.now() - 60000).toISOString();
  ranking.candidates.forEach((candidate, index) => { candidate.libraryId = libraries[index]; });
  ranking.baselineLibraryId = libraries[0]; ranking.combinedLibraryId = libraries[1];
  classId = String((await db.query(`INSERT INTO classification_history(title,tmdb_id,media_type,method,status,library_id,library_name,created_at,metadata)
    VALUES('Synthetic review',603,'movie','policy_auto','completed',$1,'Original',NOW()-INTERVAL '1 day',$2) RETURNING id`,
  [libraries[0], { classification_details: { destination_decision: capture, inventory_ranking_shadow: ranking,
    ranked_candidates: [{ library_id: libraries[1], score: 75 }], scores: { preset: 75 } } }])).rows[0].id);
  const facade = { ...db, withTransaction: (callback, options) => db.withTransaction(async client => {
    if (options?.readOnly) await client.query('SET TRANSACTION READ ONLY');
    return callback(client);
  }) };
  app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: Number(req.get('x-test-actor') || actor), role: req.get('x-test-role') || 'admin' }; next(); });
  app.use('/feedback', createFeedbackRouter({ express, db: facade, feedbackAnalysis: new FeedbackAnalysis() }));
  app.use(errorHandler);
});
afterEach(async () => {
  await db.query('DELETE FROM policy_feedback_sources'); await db.query('DELETE FROM policy_feedback_log');
  await db.query('DELETE FROM classification_history WHERE id=$1', [classId]);
  await db.query('DELETE FROM libraries WHERE id=ANY($1::integer[])', [libraries]);
  await db.query('DELETE FROM users WHERE id=ANY($1::integer[])', [[actor, otherActor]]);
});
const prepare = (owner = actor) => request(app).post(`/feedback/${classId}/review`).set('x-test-actor', String(owner)).send({});
const command = (review, action = 'confirmation') => ({ reviewId: review.reviewId, action,
  selected_library_id: libraries[action === 'confirmation' ? 0 : 1], selected_policy_id: policies[action === 'confirmation' ? 0 : 1] });
const submit = (body, owner = actor) => request(app).post(`/feedback/${classId}/review/submit`).set('x-test-actor', String(owner)).send(body);
const receipt = (reviewId, owner = actor) => request(app).get(`/feedback/${classId}/review/${reviewId}/receipt`).set('x-test-actor', String(owner));
const stored = async () => (await db.query('SELECT * FROM policy_feedback_sources WHERE classification_id=$1', [classId])).rows[0];

test.each(['confirmation', 'correction'])('explicit %s binds the original destination, not shortlist, with one vote and no history mutation', async action => {
  const before = (await db.query('SELECT * FROM classification_history WHERE id=$1', [classId])).rows;
  const review = (await prepare().expect(200)).body;
  expect(review.reference).toMatchObject({ kind: 'original_automated_destination', libraryId: libraries[0], libraryName: 'Original' });
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_sources')).rows[0].count).toBe(0);
  const body = command(review, action); await submit(body).expect(201);
  expect((await stored()).outcome_snapshot).toMatchObject({ version: 'classification.feedback_outcome.v3', action,
    reference: { reviewId: review.reviewId, libraryId: libraries[0] } });
  const rows = (await db.query(INVENTORY_PROSPECTIVE_OUTCOME_SQL, ['2000-01-01', '2999-01-01'])).rows;
  expect(evaluateInventoryProspectiveOutcomes(rows)).toMatchObject({ sampleSize: 1, kinds: { [action]: { sampled: 1 } } });
  expect((await db.query('SELECT * FROM classification_history WHERE id=$1', [classId])).rows).toEqual(before);
  expect((await submit(body).expect(200)).body.replayed).toBe(true);
  expect((await receipt(review.reviewId).expect(200)).body).toMatchObject({ status: 'recorded' });
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_log')).rows[0].count).toBe(1);
  expect((await db.query('SELECT was_correction,top_suggestion_library_id FROM policy_feedback_log')).rows[0]).toEqual({
    was_correction: action === 'confirmation', top_suggestion_library_id: libraries[1],
  }); // Existing statistics remain shortlist-relative; the new explicit action is original-decision-relative.
});

test('cross-actor use, stale source, changed destination and implicit action cannot commit', async () => {
  const review = (await prepare().expect(200)).body;
  await submit(command(review), otherActor).expect(409);
  await submit({ ...command(review), action: 'selection' }).expect(400);
  await submit({ ...command(review), selected_library_id: libraries[1], selected_policy_id: policies[1] }).expect(409);
  await db.query("UPDATE classification_history SET title='Changed review' WHERE id=$1", [classId]);
  await submit(command(review)).expect(409);
  expect(await stored()).toBeUndefined();
});

test('expiry and reissue invalidate old references without creating outcomes; active actor is rechecked', async () => {
  const first = (await prepare().expect(200)).body;
  const second = (await prepare().expect(200)).body;
  await submit(command(first)).expect(409);
  await db.query("UPDATE feedback_review_references SET created_at=created_at-INTERVAL '11 minutes',expires_at=expires_at-INTERVAL '11 minutes'");
  await submit(command(second)).expect(409);
  await pruneFeedbackReviewReferences(db);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM feedback_review_references')).rows[0].count).toBe(0);
  const fresh = (await prepare().expect(200)).body;
  await db.query("UPDATE users SET role='user' WHERE id=$1", [actor]);
  await submit(command(fresh)).expect(403); await receipt(fresh.reviewId).expect(403);
  expect(await stored()).toBeUndefined();
});

test('concurrent exact commands commit once; replay and scoped lookup survive expiry and history deletion', async () => {
  const review = (await prepare().expect(200)).body, body = command(review);
  const results = await Promise.all([submit(body), submit(body), submit(body)]);
  expect(results.map(result => result.status).sort()).toEqual([200, 200, 201]);
  await recreateFeedbackReceiptAt(db, classId, new Date(Date.now() - 31 * 86400000));
  await pruneFeedbackOutcomeSnapshots(db);
  await db.query('DELETE FROM classification_history WHERE id=$1', [classId]);
  expect((await stored()).outcome_snapshot).toBeNull();
  await submit(body).expect(200);
  const own = await receipt(review.reviewId).expect(200); expect(own.body.status).toBe('recorded');
  expect(own.headers['cache-control']).toBe('no-store');
  expect((await receipt(review.reviewId, otherActor).expect(200)).body.status).toBe('unverified');
  await submit(body, otherActor).expect(409);
});

test('a late receipt failure rolls back consumption and feedback; prepared restore reset is transactional', async () => {
  const review = (await prepare().expect(200)).body;
  await db.query('ALTER TABLE policy_feedback_sources ADD CONSTRAINT review_fixture_reject CHECK(FALSE) NOT VALID');
  try { await submit(command(review)).expect(500); }
  finally { await db.query('ALTER TABLE policy_feedback_sources DROP CONSTRAINT review_fixture_reject'); }
  expect((await db.query('SELECT COUNT(*)::int AS count FROM feedback_review_references')).rows[0].count).toBe(1);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_log')).rows[0].count).toBe(0);
  await expect(db.withTransaction(async client => { await resetFeedbackReviewReferences(client); throw new Error('fixture rollback'); })).rejects.toThrow('fixture rollback');
  await submit(command(review)).expect(201);
});

test('legacy/imported or manually changed sources and non-admin projections stay unavailable', async () => {
  await request(app).post(`/feedback/${classId}/review`).set('x-test-role', 'user').send({}).expect(403);
  await db.query("UPDATE classification_history SET method='source_library' WHERE id=$1", [classId]);
  await prepare().expect(409);
  await db.query("UPDATE classification_history SET method='policy_auto',metadata='{}' WHERE id=$1", [classId]);
  await prepare().expect(409);
  expect(await stored()).toBeUndefined();
});

test('concurrent issuances cannot exceed the global preparation cap', async () => {
  const fixtureActors = (await db.query(`INSERT INTO users(username,password_hash,role)
    SELECT 'cap-fixture-'||n,'synthetic','admin' FROM generate_series(1,99) n RETURNING id`)).rows.map(row => row.id);
  try {
    const projection = (await prepare().expect(200)).body;
    await db.query('DELETE FROM feedback_review_references');
    await db.query(`INSERT INTO feedback_review_references(id,actor_id,classification_id,projection)
      SELECT gen_random_uuid(),unnest($1::integer[]),$2,$3::jsonb`, [fixtureActors, classId, projection]);
    const responses = await Promise.all([prepare(actor), prepare(otherActor)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await db.query('SELECT COUNT(*)::int AS count FROM feedback_review_references')).rows[0].count).toBe(100);
    expect(await stored()).toBeUndefined();
  } finally { await db.query('DELETE FROM users WHERE id=ANY($1::integer[])', [fixtureActors]); }
});

test('receipt bindings are immutable and feedback deletion leaves recoverable proof', async () => {
  const review = (await prepare().expect(200)).body; await submit(command(review)).expect(201);
  await expect(db.query("UPDATE policy_feedback_sources SET review_id=gen_random_uuid() WHERE classification_id=$1", [classId])).rejects.toMatchObject({ code: '23514' });
  await expect(db.query("UPDATE policy_feedback_sources SET review_actor_fingerprint=repeat('c',64) WHERE classification_id=$1", [classId])).rejects.toMatchObject({ code: '23514' });
  await db.query('DELETE FROM policy_feedback_log WHERE id=$1', [(await stored()).feedback_id]);
  expect((await receipt(review.reviewId).expect(200)).body).toMatchObject({ status: 'recorded', feedbackId: null });
  expect((await submit(command(review)).expect(409)).body.code).toBe('FEEDBACK_RESULT_UNAVAILABLE');
  await prepare().expect(409);
});

test.each(['library', 'policy'])('an edited %s rejects its prepared choice without effects', async kind => {
  const review = (await prepare().expect(200)).body;
  if (kind === 'library') await db.query('UPDATE libraries SET is_active=false WHERE id=$1', [libraries[0]]);
  else {
    await db.query('DELETE FROM library_policies WHERE id=$1', [policies[1]]);
    await db.query('UPDATE library_policies SET library_id=$1 WHERE id=$2', [libraries[1], policies[0]]);
  }
  await submit(command(review)).expect(409); expect(await stored()).toBeUndefined();
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_log')).rows[0].count).toBe(0);
});

test('a legacy selection and explicit review racing cannot create parallel votes', async () => {
  const review = (await prepare().expect(200)).body;
  const legacy = request(app).post('/feedback').send({ classification_id: classId,
    selected_library_id: libraries[1], selected_policy_id: policies[1] });
  const responses = await Promise.all([legacy, submit(command(review))]);
  expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_log')).rows[0].count).toBe(1);
  expect((await db.query('SELECT COUNT(*)::int AS count FROM policy_feedback_sources')).rows[0].count).toBe(1);
});
