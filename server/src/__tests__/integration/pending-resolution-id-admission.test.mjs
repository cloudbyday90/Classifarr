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
const { registerPendingQuestionCleanupApplyRoute } = await import('../../routes/classificationRoutePendingCleanupApply.mjs');
const { PolicyRuntimePendingQuestionCleanupApplyService } = await import('../../services/policyRuntimePendingQuestionCleanupApplyService.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { normalizePolicyRuntimeQuestion } = await import('../../services/policyRuntimeQuestionNormalizer.mjs');
const { buildPolicyRuntimeQuestionAnswerContract } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const { ClassificationOutcomeService } = await import('../../services/classificationOutcomeService.mjs');
const { recordNativePendingRouteOutcome } = await import('../../services/policyNativePendingRouteOutcomePersistence.mjs');
const { createPolicyRuntimeExactItemMemoryAutoLearningService } =
  await import('../../services/policyRuntimeExactItemMemoryAutoLearningService.mjs');
const { PolicyRuntimeExactItemMemoryCommandService } =
  await import('../../services/policyRuntimeExactItemMemoryCommandService.mjs');
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
  registerPendingQuestionCleanupApplyRoute(app, {
    policyRuntimePendingQuestionCleanupApplyService: new PolicyRuntimePendingQuestionCleanupApplyService({ db: database }),
    requireReadWrite,
  });
  app.use(errorHandler);
  const http = request(app);
  const resolve = (historyId, payload = answer) => http.post(`/pending/${historyId}/resolve`).send(payload);

  for (const refused of [`${id}x`, large, adjacent]) await resolve(refused).expect(400);
  await http.post('/pending-cleanup/apply').send({ classificationIds: [id, adjacent] }).expect(400);
  expect(await snapshot()).toEqual(before);
  expect(routeToArr).not.toHaveBeenCalled();

  const first = await resolve(id).expect(200);
  expect(first.body).toMatchObject({ classificationId: id, success: true, libraryId: destination.id, shouldRoute: true });
  const saved = await snapshot();
  expect(saved[0]).toMatchObject({ status: 'completed', library_id: destination.id });
  const recordedAnswer = saved[0].metadata.classification_details.outcome_link.runtime_question_answer;
  expect(recordedAnswer).toMatchObject({ ...answer, classification_id: id });
  expect(saved.slice(1)).toEqual(before.slice(1));

  const replay = await resolve(id).expect(200);
  expect(replay.body).toMatchObject({ classificationId: id, success: true, alreadyResolved: true, idempotent: true, shouldRoute: false });
  await resolve(id, { ...answer, action_id: 'confirm_destination' }).expect(409);
  expect(await snapshot()).toEqual(saved);

  const replaceReceipt = receipt => query(`UPDATE classification_history
    SET metadata=jsonb_set(metadata,'{classification_details,outcome_link,runtime_question_answer}',$2::jsonb)
    WHERE id=$1`, [id, JSON.stringify(receipt)]);
  await replaceReceipt({ ...recordedAnswer, classification_id: id - 1 });
  const mismatched = await snapshot();
  await resolve(id).expect(409);
  expect(await snapshot()).toEqual(mismatched);

  const legacyAnswer = { ...recordedAnswer };
  delete legacyAnswer.classification_id;
  await replaceReceipt(legacyAnswer);
  const legacy = await snapshot();
  expect((await resolve(id).expect(200)).body).toMatchObject({ alreadyResolved: true, idempotent: true, shouldRoute: false });
  expect(await snapshot()).toEqual(legacy);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('native routing provenance persists only to the exact History row', async () => {
  const previousId = '9007199254740996';
  const targetId = '9007199254740997';
  const { rows: [destination] } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Owned route destination','pending-native-route-dst','movie',true) RETURNING id,name`);
  for (const [index, id] of [previousId, targetId].entries()) {
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,library_id,metadata)
      VALUES($1,$2,$3,'movie','completed',$4,$5::jsonb)`,
    [id, `Owned route outcome ${index}`, 892019 + index, destination.id, JSON.stringify({ sentinel: id })]);
  }
  const snapshot = async () => (await query(`SELECT id, metadata FROM classification_history
    WHERE id=ANY($1::bigint[]) ORDER BY id`, [[previousId, targetId]])).rows;
  const before = await snapshot();
  const outcomeService = new ClassificationOutcomeService({ db: database });
  const persist = classificationId => recordNativePendingRouteOutcome({
    classificationId,
    nativeResolutionProvenance: {
      statusId: 'outcome_only',
      selection: { selectedDestination: { libraryId: destination.id, libraryName: destination.name } },
    },
    routingOutcome: { attempted: true, routed: true },
    outcomeService,
    loggerInstance: createMockLogger(),
  });

  expect(await persist(`0${targetId}`)).toMatchObject({ persisted: false, reason: 'not_applicable' });
  expect(await persist(Number(targetId))).toMatchObject({ persisted: false, reason: 'not_applicable' });
  expect(await snapshot()).toEqual(before);

  expect(await persist(targetId)).toMatchObject({ persisted: true });
  const after = await snapshot();
  expect(after[0]).toEqual(before[0]);
  expect(after[1]).toMatchObject({
    id: targetId,
    metadata: {
      sentinel: targetId,
      classification_details: {
        outcome_link: { type: 'native_pending_route', event_type_id: 'route_succeeded', final_library_id: destination.id },
      },
    },
  });
});

test('automatic exact-item learning keeps adjacent History receipts distinct across transactions', async () => {
  const [firstId, secondId, maxId] = ['9007199254741000', '9007199254741001', '9223372036854775807'];
  const ids = [firstId, secondId, maxId];
  const tmdbIds = [892031, 892032, 892033];
  const fingerprint = 'abcdefghijklmnopqrstuv';
  const { rows: [destination] } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Owned memory destination','pending-memory-dst','movie',true) RETURNING id,name`);
  const metadata = { classification_details: { outcome_link: {
    type: 'resolved', source: 'policy_question', final_library_id: destination.id, final_library_name: destination.name,
    runtime_question_answer: {
      action_id: 'confirm_destination', contract_version: 'policy.runtime_question_answer.v1',
      contract_fingerprint: fingerprint, destination_library_id: destination.id,
    },
  } } };
  for (const [index, id] of ids.entries()) {
    metadata.classification_details.outcome_link.runtime_question_answer.classification_id = id;
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,library_id,library_name,metadata)
      VALUES($1,$2,$3,'movie','completed',$4,$5,$6::jsonb)`,
    [id, `Owned learning item ${index}`, tmdbIds[index], destination.id, destination.name, JSON.stringify(metadata)]);
  }

  const commandService = new PolicyRuntimeExactItemMemoryCommandService({ db: database });
  const execute = jest.spyOn(commandService, 'execute');
  const autoLearning = createPolicyRuntimeExactItemMemoryAutoLearningService({ commandService, logger: createMockLogger() });
  const record = classificationId => autoLearning.record({
    classificationId, actorId: 'owned-operator', authenticated: true,
    answerActionId: 'confirm_destination', resolutionSucceeded: true,
  });
  const receipts = async () => (await query(`SELECT id, classification_id, source_event_id, command_fingerprint
    FROM policy_authorized_outcome_source_event_receipts WHERE classification_id=ANY($1::bigint[]) ORDER BY classification_id`, [ids])).rows;
  const evidence = async () => (await query(`SELECT id, tmdb_id, library_id FROM classification_evidence
    WHERE scope='item_exact' AND media_type='movie' AND tmdb_id=ANY($1::bigint[]) ORDER BY tmdb_id`, [tmdbIds])).rows;
  const receiptFor = classificationId => expect.objectContaining({
    classification_id: classificationId, source_event_id: `runtime_exact_item_memory:${classificationId}:${fingerprint}`,
  });

  await expect(record(secondId)).resolves.toMatchObject({ statusId: 'recorded' });
  const savedReceipts = await receipts();
  const savedEvidence = await evidence();
  expect(savedReceipts).toEqual([receiptFor(secondId)]);
  expect(savedEvidence).toEqual([expect.objectContaining({ tmdb_id: tmdbIds[1], library_id: destination.id })]);

  await expect(record(secondId)).resolves.toMatchObject({ statusId: 'already_recorded', exactItemMemoryRecorded: false });
  await expect(execute.mock.results.at(-1).value).resolves.toMatchObject({ execution: { applied: false, replayed: true } });
  await expect(record(Number(secondId))).resolves.toMatchObject({ statusId: 'not_applicable' });
  expect(execute).toHaveBeenCalledTimes(2);
  expect(await receipts()).toEqual(savedReceipts);
  expect(await evidence()).toEqual(savedEvidence);

  await expect(record(firstId)).resolves.toMatchObject({ statusId: 'recorded' });
  await expect(record(maxId)).resolves.toMatchObject({ statusId: 'recorded' });
  expect(await receipts()).toEqual([receiptFor(firstId), savedReceipts[0], receiptFor(maxId)]);
  expect((await evidence()).map(row => row.tmdb_id)).toEqual(tmdbIds);
});
