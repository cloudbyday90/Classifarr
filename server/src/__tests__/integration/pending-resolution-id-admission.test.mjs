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
const { buildPolicyRuntimeQuestionReductionFromRuntimeInput } = await import('../../services/policyRuntimeQuestionReduction.mjs');
const { ClassificationOutcomeService } = await import('../../services/classificationOutcomeService.mjs');
const { recordNativePendingRouteOutcome } = await import('../../services/policyNativePendingRouteOutcomePersistence.mjs');
const { createPolicyRuntimeExactItemMemoryAutoLearningService } =
  await import('../../services/policyRuntimeExactItemMemoryAutoLearningService.mjs');
const { PolicyRuntimeExactItemMemoryCommandService } =
  await import('../../services/policyRuntimeExactItemMemoryCommandService.mjs');
const { errorHandler } = await import('../../middleware/errorHandler.mjs');

beforeAll(() => { database = createReadinessDatabase({ max: 4 }); });
afterAll(async () => { await database.pool.end(); });

function pendingHttp(routeToArr) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 1, username: 'owned admin', role: 'admin' }; next(); });
  registerPendingRoutes(app, { db: database, clarificationService, classificationService: { routeToArr }, logger: createMockLogger() });
  registerPendingQuestionCleanupApplyRoute(app, {
    policyRuntimePendingQuestionCleanupApplyService: new PolicyRuntimePendingQuestionCleanupApplyService({ db: database }),
    requireReadWrite,
  });
  app.use(errorHandler);
  return request(app);
}

test.each([
  { id: Number.MAX_SAFE_INTEGER, neighbors: ['9007199254740992', '9007199254740993'], tmdbBase: 892013 },
  { id: '9007199254740995', neighbors: ['9007199254740994', '9007199254740996'], tmdbBase: 892023 },
  { id: '9223372036854775807', neighbors: ['9223372036854775805', '9223372036854775806'], tmdbBase: 892043 },
])('web resolves exact ID $id once, using a row-bound answer from the pending list', async ({ id, neighbors, tmdbBase }) => {
  const { rows: libraries } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ($1,$2,'movie',true),($3,$4,'movie',true)
    RETURNING id,name,media_type,is_active`, [
    `Owned reference ${tmdbBase}`, `pending-id-ref-${tmdbBase}`,
    `Owned explicit destination ${tmdbBase}`, `pending-id-dst-${tmdbBase}`,
  ]);
  const [reference, destination] = libraries;
  const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' }, libraries,
    policyResult: { ranked: [{ library_id: reference.id, score: 78 }, { library_id: destination.id, score: 65 }] } });
  const ids = [id, ...neighbors];
  for (const [index, historyId] of ids.entries()) {
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,policy_question)
      VALUES($1,$2,$3,'movie','awaiting_decision','signal_calculation',$4::jsonb)`,
    [historyId, `Owned pending ${index}`, tmdbBase + index, JSON.stringify(question)]);
  }
  const snapshot = async () => (await query(`SELECT * FROM classification_history
    WHERE id=ANY($1::bigint[]) ORDER BY id`, [ids])).rows;
  const before = await snapshot();
  const routeToArr = jest.fn().mockResolvedValue({ routed: true });
  const http = pendingHttp(routeToArr);
  const { body: list } = await http.get('/pending').expect(200);
  const contractFor = historyId => list.items.find(row => row.id === historyId)?.policy_question_answer;
  const answerFor = ({ version, fingerprint }) => ({
    contract_version: version,
    contract_fingerprint: fingerprint,
    action_id: 'change_destination',
    destination_library_id: destination.id,
  });
  for (const historyId of ids) {
    expect(contractFor(historyId)).toMatchObject({ candidate_item: { classification_id: historyId } });
  }
  const answer = answerFor(contractFor(id));
  const resolve = (historyId, payload = answer) => http.post(`/pending/${historyId}/resolve`).send(payload);

  for (const refused of [`${id}x`, '9223372036854775808']) await resolve(refused).expect(400);
  await resolve(id, answerFor(contractFor(neighbors[0]))).expect(409);
  await resolve('9223372036854775802').expect(404);
  await http.post('/pending-cleanup/apply').send({ classificationIds: [id, '9223372036854775808'] }).expect(400);
  expect(await snapshot()).toEqual(before);
  expect(routeToArr).not.toHaveBeenCalled();

  const replies = await Promise.all([resolve(id).expect(200), resolve(id).expect(200)]);
  const first = replies.find(reply => reply.body.shouldRoute);
  const concurrentReplay = replies.find(reply => !reply.body.shouldRoute);
  expect(first?.body).toMatchObject({ classificationId: id, success: true, libraryId: destination.id, routed: true });
  expect(concurrentReplay?.body).toMatchObject({ classificationId: id, alreadyResolved: true, idempotent: true, routed: false });
  const saved = await snapshot();
  const target = saved.find(row => row.id === id);
  expect(target).toMatchObject({ status: 'routed', library_id: destination.id });
  const recordedAnswer = target.metadata.classification_details.outcome_link.runtime_question_answer;
  expect(recordedAnswer).toMatchObject({ ...answer, classification_id: id });
  expect(saved.filter(row => row.id !== id)).toEqual(before.filter(row => row.id !== id));
  const learningReceipts = async () => (await query(`SELECT id, source_event_id, command_fingerprint
    FROM policy_authorized_outcome_source_event_receipts WHERE classification_id=$1 ORDER BY id`, [id])).rows;
  const savedLearning = await learningReceipts();
  expect(savedLearning).toHaveLength(1);

  const replay = await resolve(id).expect(200);
  expect(replay.body).toMatchObject({ classificationId: id, success: true, alreadyResolved: true, idempotent: true, shouldRoute: false });
  await resolve(id, { ...answer, action_id: 'confirm_destination' }).expect(409);
  expect(await snapshot()).toEqual(saved);

  const replaceReceipt = receipt => query(`UPDATE classification_history
    SET metadata=jsonb_set(metadata,'{classification_details,outcome_link,runtime_question_answer}',$2::jsonb)
    WHERE id=$1`, [id, JSON.stringify(receipt)]);
  await replaceReceipt({ ...recordedAnswer, destination_library_id: `0${destination.id}` });
  const historical = await snapshot();
  expect((await resolve(id).expect(200)).body).toMatchObject({ idempotent: true, shouldRoute: false });
  expect(await snapshot()).toEqual(historical);

  await replaceReceipt({ ...recordedAnswer, classification_id: neighbors[0] });
  const mismatched = await snapshot();
  await resolve(id).expect(409);
  expect(await snapshot()).toEqual(mismatched);

  const legacyAnswer = { ...recordedAnswer };
  delete legacyAnswer.classification_id;
  await replaceReceipt(legacyAnswer);
  const legacy = await snapshot();
  if (typeof id === 'number') {
    expect((await resolve(id).expect(200)).body).toMatchObject({ alreadyResolved: true, idempotent: true, shouldRoute: false });
  } else {
    await resolve(id).expect(409);
  }
  expect(await snapshot()).toEqual(legacy);

  await query(`UPDATE classification_history
    SET metadata=metadata #- '{classification_details,outcome_link,runtime_question_answer}'
    WHERE id=$1`, [id]);
  const withoutReceipt = await snapshot();
  await resolve(id).expect(409);
  expect(await snapshot()).toEqual(withoutReceipt);
  expect(await learningReceipts()).toEqual(savedLearning);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('validates a destination before lookup and accepts the INTEGER maximum as decimal text', async () => {
  const id = '9007199254741018';
  const { rows: [destination] } = await query(`INSERT INTO libraries(id,name,external_id,media_type,is_active)
    VALUES (2147483647,'Owned max destination','pending-max-destination','movie',true)
    RETURNING id,name,media_type,is_active`);
  const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' }, libraries: [destination],
    policyResult: { ranked: [{ library_id: destination.id, score: 78 }] } });
  await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,policy_question)
    VALUES($1,'Owned pending INTEGER maximum',892058,'movie','awaiting_decision','signal_calculation',$2::jsonb)`, [id, JSON.stringify(question)]);
  const routeToArr = jest.fn().mockResolvedValue({ routed: true });
  const http = pendingHttp(routeToArr);
  const { body: list } = await http.get('/pending').expect(200);
  const contract = list.items.find(row => row.id === id).policy_question_answer;
  const base = { contract_version: contract.version, contract_fingerprint: contract.fingerprint, action_id: 'confirm_destination' };
  const resolve = destinationId => http.post(`/pending/${id}/resolve`).send({ ...base, destination_library_id: destinationId });
  const readRow = async () => (await query('SELECT * FROM classification_history WHERE id=$1', [id])).rows[0];
  const pending = await readRow();
  for (const malformed of [[destination.id], `0${destination.id}`, '2147483648']) {
    await resolve(malformed).expect(400);
  }
  expect(await readRow()).toEqual(pending);
  expect(routeToArr).not.toHaveBeenCalled();

  expect((await resolve(String(destination.id)).expect(200)).body).toMatchObject({
    classificationId: id, libraryId: destination.id, routed: true,
  });
  const saved = await readRow();
  expect(saved.metadata.classification_details.outcome_link.runtime_question_answer).toMatchObject({
    ...base, classification_id: id, destination_library_id: destination.id,
  });
  expect((await resolve(destination.id).expect(200)).body).toMatchObject({ idempotent: true, shouldRoute: false });
  expect(await readRow()).toEqual(saved);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('keeps valid neighbors visible when saved context references are invalid', async () => {
  const ids = ['9007199254741020', '9007199254741021', '9007199254741022', '9007199254741023'];
  const { rows: [destination] } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Owned context destination','pending-context-destination','movie',true)
    RETURNING id,name,media_type,is_active`);
  const { rows: [policy] } = await query(`INSERT INTO library_policies(library_id,name,enabled)
    VALUES ($1,'Owned context policy',true) RETURNING id`, [destination.id]);
  const question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' }, libraries: [destination],
    policyResult: { ranked: [{ library_id: destination.id, policy_id: policy.id, score: 89 }] } });
  for (const [index, id] of ids.entries()) {
    await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,policy_question)
      VALUES($1,'Owned pending context', $2,'movie','awaiting_decision','signal_calculation',$3::jsonb)`,
    [id, 892060 + index, JSON.stringify(question)]);
  }
  const routeToArr = jest.fn();
  const http = pendingHttp(routeToArr);
  const list = async () => (await http.get('/pending').expect(200)).body.items;
  const previous = (await list()).filter(row => ids.includes(row.id));
  expect(previous).toHaveLength(ids.length);
  const invalidQuestions = ids.slice(1).map(() => structuredClone(question));
  invalidQuestions[0].meta.candidates[0].policy_id = '2147483648';
  invalidQuestions[1].meta.candidates[0].library_id = '2147483648';
  invalidQuestions[2].options[0].library_id = { toString: null };
  for (const [index, corrupt] of invalidQuestions.entries()) {
    await query('UPDATE classification_history SET policy_question=$2::jsonb WHERE id=$1',
      [ids[index + 1], JSON.stringify(corrupt)]);
  }
  const snapshot = async () => (await query('SELECT * FROM classification_history WHERE id=ANY($1::bigint[]) ORDER BY id', [ids])).rows;
  const saved = await snapshot();
  const items = await list();
  expect(items.filter(row => ids.includes(row.id))).toHaveLength(ids.length);
  const itemFor = id => items.find(row => row.id === id);
  const previousContract = id => previous.find(row => row.id === id).policy_question_answer;
  expect(itemFor(ids[0]).policy_question_answer).toEqual(previousContract(ids[0]));
  for (const [index, id] of ids.slice(1).entries()) {
    const item = itemFor(id);
    expect(item).toMatchObject({
      policy_question_stale: true,
      policy_question_stale_reason: 'policy_context_invalid',
      policy_question_current_context_version: null,
      policy_question_answer: null,
      policy_question: invalidQuestions[index],
    });
    const { version, fingerprint } = previousContract(id);
    const refused = await http.post(`/pending/${id}/resolve`).send({
      contract_version: version, contract_fingerprint: fingerprint,
      action_id: 'confirm_destination', destination_library_id: destination.id,
    }).expect(409);
    expect(refused.body.code).toBe('policy_question_stale');
  }
  expect(await snapshot()).toEqual(saved);
  expect(routeToArr).not.toHaveBeenCalled();
  await query('DELETE FROM classification_history WHERE id=ANY($1::bigint[])', [ids]);
});

test('native web resolution records its exact answer beside the retained route outcome', async () => {
  const id = '9007199254741017';
  const { rows: [destination] } = await query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES ('Owned native answer','owned-native-answer','movie',true) RETURNING id,name`);
  const plan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: { identityCandidates: [{ label: 'Animation', count: 1, confidence: 0.6 }] },
    metadataSignals: [{ label: 'Family', confidence: 0.7 }],
  });
  const question = {
    version: 'policy.runtime_question_persistence.v1',
    question: plan.question.operatorQuestion,
    options: [
      { label: 'Resolve current item', outcomeId: 'resolve_current_item', library_id: destination.id },
      { label: 'Do not learn', outcomeId: 'do_not_learn' },
    ],
    runtimeQuestion: plan.question,
    runtimeQuestionReductionPlan: plan,
    meta: { runtime_question_persistence: { destinationLibraryId: destination.id, destinationLibraryName: destination.name } },
  };
  await query(`INSERT INTO classification_history(id,title,tmdb_id,media_type,status,method,policy_question)
    VALUES($1,'Owned native answer',892053,'movie','awaiting_decision','signal_calculation',$2::jsonb)`, [id, JSON.stringify(question)]);
  const routeToArr = jest.fn().mockResolvedValue({ attempted: true, routed: true });
  const http = pendingHttp(routeToArr);
  const { body: list } = await http.get('/pending').expect(200);
  const contract = list.items.find(row => row.id === id)?.policy_question_answer;
  expect(contract).toMatchObject({ candidate_item: { classification_id: id } });
  const answer = {
    contract_version: contract.version, contract_fingerprint: contract.fingerprint,
    action_id: 'confirm_destination', destination_library_id: destination.id,
  };
  const resolve = () => http.post(`/pending/${id}/resolve`).send(answer).expect(200);
  expect((await resolve()).body).toMatchObject({ classificationId: id, routed: true });
  const snapshot = async () => (await query('SELECT id, status, metadata FROM classification_history WHERE id=$1', [id])).rows[0];
  const saved = await snapshot();
  expect(saved).toMatchObject({ id, status: 'routed', metadata: { classification_details: { outcome_link: {
    type: 'native_pending_route', event_type_id: 'route_succeeded',
    runtime_question_answer: { ...answer, classification_id: id },
  } } } });
  expect((await resolve()).body).toMatchObject({ classificationId: id, alreadyResolved: true, idempotent: true, shouldRoute: false });
  expect(await snapshot()).toEqual(saved);
  expect(routeToArr).toHaveBeenCalledTimes(1);
});

test('native routing provenance persists only to the exact History row', async () => {
  const previousId = '9007199254741012';
  const targetId = '9007199254741013';
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
  expect(await outcomeService.recordOutcome(Number(targetId), { type: 'resolved' })).toEqual({
    updated: false, reason: 'invalid_classification_id',
  });
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
  const [firstId, secondId, nearMaxId] = ['9007199254741000', '9007199254741001', '9223372036854775804'];
  const ids = [firstId, secondId, nearMaxId];
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
  await expect(record(nearMaxId)).resolves.toMatchObject({ statusId: 'recorded' });
  expect(await receipts()).toEqual([receiptFor(firstId), savedReceipts[0], receiptFor(nearMaxId)]);
  expect((await evidence()).map(row => row.tmdb_id)).toEqual(tmdbIds);
});
