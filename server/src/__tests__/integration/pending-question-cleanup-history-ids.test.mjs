/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { registerPendingQuestionCleanupApplyRoute } = await import('../../routes/classificationRoutePendingCleanupApply.mjs');
const { registerPendingQuestionCleanupInventoryRoute } = await import('../../routes/classificationRoutePendingCleanupInventory.mjs');
const { PolicyRuntimePendingQuestionCleanupApplyService } = await import('../../services/policyRuntimePendingQuestionCleanupApplyService.mjs');
const { PolicyRuntimePendingQuestionCleanupInventoryService } = await import('../../services/policyRuntimePendingQuestionCleanupInventoryService.mjs');
const { buildPolicyRuntimeQuestionAnswerContract } = await import('../../services/policyRuntimeQuestionAnswerContract.mjs');
const { buildPolicyRuntimeQuestionAnswerReceipt } = await import('../../services/policyRuntimeQuestionAnswerReceipt.mjs');
const { normalizePolicyRuntimeQuestion } = await import('../../services/policyRuntimeQuestionNormalizer.mjs');
const { extractQuestionContext, stampPolicyQuestionContext } = await import('../../utils/policyQuestionContext.mjs');

const applyUrl = '/api/classification/pending-cleanup/apply';
const inventoryUrl = '/api/classification/pending-cleanup/inventory';
const router = express.Router();
router.use(authenticateToken);
registerPendingQuestionCleanupApplyRoute(router, {
  policyRuntimePendingQuestionCleanupApplyService: new PolicyRuntimePendingQuestionCleanupApplyService({ db }),
  requireReadWrite,
});
registerPendingQuestionCleanupInventoryRoute(router, {
  policyRuntimePendingQuestionCleanupInventoryService: new PolicyRuntimePendingQuestionCleanupInventoryService({ db }),
});
const app = createIntegrationTestApp({ basePath: '/api/classification', router });
let token;
let destination;
let disabledPolicyId;

beforeAll(async () => {
  const { rows: [actor] } = await db.query(`INSERT INTO users (username, password_hash, role)
    VALUES ('cleanup-id-fixture-admin', 'fixture', 'admin') RETURNING id, username, role`);
  token = await generateAccessToken(actor);
  const { rows: [library] } = await db.query(`INSERT INTO libraries (name, external_id, media_type, updated_at)
    VALUES ('Cleanup destination', 'cleanup-id-fixture-library', 'movie', TIMESTAMP '2026-11-22 12:00:00')
    RETURNING id, name, media_type, is_active`);
  destination = library;
  const { rows: [policy] } = await db.query(`INSERT INTO library_policies (library_id, name, enabled)
    VALUES ($1, 'Disabled cleanup fixture policy', false) RETURNING id`, [destination.id]);
  disabledPolicyId = policy.id;
});

function apply(classificationIds) {
  return request(app).post(applyUrl).set('Authorization', `Bearer ${token}`).send({ classificationIds });
}

async function insertPending(id, question = null) {
  const { rows: [row] } = await db.query(`INSERT INTO classification_history
    (id, title, media_type, status, method, policy_question)
    VALUES ($1, 'Cleanup History fixture', 'movie', 'awaiting_decision', 'signal_calculation', $2::jsonb)
    RETURNING *`, [id, question === null ? null : JSON.stringify(question)]);
  return row;
}

async function readRows(ids) {
  return (await db.query('SELECT * FROM classification_history WHERE id = ANY($1::bigint[]) ORDER BY id', [ids])).rows;
}

async function recordAnswer(id, { contextVersion, policyId, binding = id } = {}) {
  let question = normalizePolicyRuntimeQuestion({
    metadata: { media_type: 'movie' }, libraries: [destination],
    policyResult: { ranked: [{ library_id: destination.id, policy_id: policyId, score: 88 }] },
  });
  if (contextVersion || policyId) {
    question = stampPolicyQuestionContext(question, contextVersion, extractQuestionContext(question));
  }
  const classification = await insertPending(id, question);
  const contract = buildPolicyRuntimeQuestionAnswerContract({ classification, question });
  const receipt = buildPolicyRuntimeQuestionAnswerReceipt(id, {
    contractVersion: contract.version, contractFingerprint: contract.fingerprint,
    actionId: 'confirm_destination', destinationLibraryId: destination.id,
  });
  if (binding === null) delete receipt.classification_id;
  else receipt.classification_id = binding;
  await db.query('UPDATE classification_history SET metadata = $2::jsonb WHERE id = $1', [id, JSON.stringify({
    classification_details: { outcome_link: { runtime_question_answer: receipt } },
  })]);
  return receipt;
}

test('previews, locks and repeats mixed batches with exact IDs through BIGINT max', async () => {
  const ids = [42, '9007199254740992', '9007199254740993', '9223372036854775807'];
  for (const id of ids) await insertPending(id);
  const initial = await readRows(ids);
  const { body: preview } = await request(app).get(inventoryUrl)
    .set('Authorization', `Bearer ${token}`).expect(200);
  expect(preview.records.map(({ classificationId }) => classificationId)).toEqual(ids);
  await apply([ids[0], String(ids[0])]).expect(400);
  await apply([ids[0], '9223372036854775808']).expect(400);
  expect(await readRows(ids)).toEqual(initial);

  const replies = await Promise.all([apply([...ids].reverse()).expect(200), apply(ids).expect(200)]);
  for (const { body } of replies) {
    expect(body.records.map(({ classificationId }) => classificationId)).toEqual(ids);
    expect(body.summary.queued_fresh_runtime_evaluation).toBe(ids.length);
  }
  expect(replies.map(({ body }) => body.summary.replayedRecordCount).sort()).toEqual([0, ids.length]);
  const receipts = ({ body }) => body.records.map(({ replayReceipt }) => replayReceipt);
  expect(receipts(replies[0])).toEqual(receipts(replies[1]));
  const saved = await readRows(ids);
  const repeated = await apply(ids).expect(200);
  expect(receipts(repeated)).toEqual(receipts(replies[0]));
  expect(await readRows(ids)).toEqual(saved);
  const { rows: audits } = await db.query(`SELECT classification_id, replay_receipt
    FROM policy_runtime_pending_question_cleanup_audits
    WHERE classification_id = ANY($1::bigint[]) ORDER BY classification_id`, [ids]);
  expect(audits.map(({ classification_id, replay_receipt }) => [classification_id, replay_receipt]))
    .toEqual(ids.map((id, index) => [id, receipts(repeated)[index]]));
});

test('replays an exact large answer on its own row only', async () => {
  const id = '9007199254741000';
  const neighbor = '9007199254741001';
  await recordAnswer(id);
  await recordAnswer(neighbor);
  const [untouched] = await readRows([neighbor]);
  const { body } = await apply([id]).expect(200);
  expect(body.records).toMatchObject([{ classificationId: id, resultStatusId: 'resolved_outcome_only' }]);
  expect(body.sideEffects.learningWritten).toBe(false);
  const [resolved, adjacent] = await readRows([id, neighbor]);
  expect(resolved).toMatchObject({ status: 'completed', library_id: destination.id, policy_question: null });
  expect(resolved.metadata.classification_details.outcome_link.runtime_question_answer.classification_id).toBe(id);
  expect(adjacent).toEqual(untouched);
  const { body: repeated } = await apply([id]).expect(200);
  expect(repeated.records).toMatchObject([{ classificationId: id, resultStatusId: 'unchanged' }]);
  expect(await readRows([id, neighbor])).toEqual([resolved, adjacent]);
});

test.each([
  ['changed context', 43, { contextVersion: '2026-11-20T00:00:00Z' }, 'policy_context_changed'],
  ['disabled policy', 44, () => ({ policyId: disabledPolicyId }), 'current_state_unavailable'],
  ['missing policy', '9007199254741004', { policyId: 2147483647 }, 'current_state_unavailable'],
  ['other row binding', '9007199254741005', { binding: '9007199254741004' }, 'runtime_answer_invalid_current_state'],
  ['unbound large receipt', '9007199254741006', { binding: null }, 'runtime_answer_invalid_current_state'],
])('queues fresh evaluation for %s', async (_label, id, options, reason) => {
  const receipt = await recordAnswer(id, typeof options === 'function' ? options() : options);
  const { body } = await apply([id]).expect(200);
  expect(body.records).toMatchObject([{
    classificationId: id, resultStatusId: 'queued_fresh_runtime_evaluation',
    reasonIds: expect.arrayContaining([`pending_question_cleanup_${reason}`]),
  }]);
  const [row] = await readRows([id]);
  expect(row).toMatchObject({ status: 'pending_retry', library_id: null, policy_question: null });
  expect(row.metadata.classification_details.outcome_link.runtime_question_answer).toEqual(receipt);
  expect(body.sideEffects.learningWritten).toBe(false);
});
