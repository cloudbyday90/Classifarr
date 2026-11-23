/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterAll, beforeAll, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createReadinessDatabase } from '../helpers/readinessDatabase.mjs';
import { createMockLogger } from '../helpers/mockFactory.mjs';

let database;
const query = (...args) => database.query(...args);
const withTransaction = (...args) => database.withTransaction(...args);
jest.unstable_mockModule('../../config/database.mjs', () => ({ query, withTransaction, default: { query, withTransaction } }));

const { clarificationService } = await import('../../services/clarificationService.mjs');
const { registerPendingRoutes } = await import('../../routes/classificationRoutePending.mjs');
const { normalizePolicyRuntimeQuestion } = await import('../../services/policyRuntimeQuestionNormalizer.mjs');
const { buildPolicyRuntimeQuestionAnswerContract } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterAll(async () => { await database.pool.end(); });

test('HTTP resolves the safe maximum once and preserves row-bound replay beside larger rows', async () => {
  const { rows: libraries } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Owned reference','pending-id-ref','movie',true),('Owned explicit destination','pending-id-dst','movie',true)
    RETURNING id,name,media_type,is_active`);
  const [reference, destination] = libraries;
  const id = Number.MAX_SAFE_INTEGER, large = '9007199254740992', adjacent = '9007199254740993';
  const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' }, libraries,
    policyResult: { ranked: [{ library_id: reference.id, score: 78 }, { library_id: destination.id, score: 65 }] } });
  for (const [index, historyId] of [id, large, adjacent].entries()) {
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,policy_question)
      VALUES($1,$2,$3,'movie','awaiting_decision','signal_calculation',$4::jsonb)`,
    [historyId, `Owned pending ${index}`, 892013 + index, JSON.stringify(question)]);
  }
  const snapshot = async () => (await query(`SELECT * FROM classification_history
    WHERE id=ANY($1::bigint[]) ORDER BY id`, [[id, large, adjacent]])).rows;
  const before = await snapshot();
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification: before[0], question: before[0].policy_question });
  const answer = {
    contract_version: contract.version,
    contract_fingerprint: contract.fingerprint,
    action_id: 'change_destination',
    destination_library_id: destination.id,
  };

  const routeToArr = jest.fn().mockResolvedValue({ routed: false, reason: 'fixture_route_not_configured' });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, username: 'owned admin', role: 'admin' }; next(); });
  registerPendingRoutes(app, { db: database, clarificationService, classificationService: { routeToArr }, logger: createMockLogger() });
  app.use(errorHandler);
  const http = request(app);
  const resolve = (historyId, payload = answer) => http.post(`/pending/${historyId}/resolve`).send(payload);

  for (const refused of [`${id}x`, large, adjacent]) await resolve(refused).expect(400);
  expect(await snapshot()).toEqual(before);
  expect(routeToArr).not.toHaveBeenCalled();

  const first = await resolve(id).expect(200);
  expect(first.body).toMatchObject({ classificationId: id, success: true, libraryId: destination.id, shouldRoute: true });
  const saved = await snapshot();
  expect(saved[0]).toMatchObject({ status: 'completed', library_id: destination.id });
  expect(saved[0].metadata.classification_details.outcome_link.runtime_question_answer).toMatchObject(answer);
  expect(saved.slice(1)).toEqual(before.slice(1));

  const replay = await resolve(id).expect(200);
  expect(replay.body).toMatchObject({ classificationId: id, success: true, alreadyResolved: true, idempotent: true, shouldRoute: false });
  await resolve(id, { ...answer, action_id: 'confirm_destination' }).expect(409);
  expect(await snapshot()).toEqual(saved);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});
