/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';
import { normalizePolicyRuntimeQuestion } from '../../services/policyRuntimeQuestionNormalizer.mjs';
import { buildPolicyRuntimeQuestionAnswerContract, parsePolicyRuntimeQuestionAnswer } from '../../services/policyRuntimeQuestionAnswerContract.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());
const { resolvePolicyQuestion } = await import('../../services/clarificationPolicyResolution.mjs');
const context = { extractQuestionContext: () => ({}), getPolicyQuestionContextVersion: async () => 1, isPolicyQuestionStale: () => false };
let libraries, row, question, contract;
let sequence = 0;
const routing = jest.fn();
function answer(fingerprint = contract.fingerprint) {
  return { contract_version: contract.version, contract_fingerprint: fingerprint,
    action_id: 'confirm_destination', destination_library_id: libraries[1].id };
}
// A loopback HTTP boundary around the production transaction service. The
// production route's authorization/response plumbing has separate route tests.
function app() {
  const server = express();
  server.use(express.json());
  server.post('/answer', async (req, res) => {
    const parsed = parsePolicyRuntimeQuestionAnswer(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.reason });
    try {
      const result = await resolvePolicyQuestion(row.id, parsed.answer.destinationLibraryId, null, 'synthetic-operator', false,
        { policyQuestionContext: context, answerContract: parsed.answer });
      if (result.shouldRoute) routing();
      return res.json(result);
    } catch (error) { return res.status(error.statusCode || 500).json({ code: error.code }); }
  });
  return server;
}
beforeEach(async () => {
  routing.mockClear();
  sequence++;
  libraries = (await getPool().query(`INSERT INTO libraries(name,external_id,media_type,is_active)
    VALUES($1,$2,'movie',true),($3,$4,'movie',true) RETURNING *`,
  [`Synthetic Comedy ${sequence}`, `review-comedy-${sequence}`, `Synthetic Movies ${sequence}`, `review-movies-${sequence}`])).rows;
  const ranked = [{ library_id: libraries[1].id, score: 18 }, { library_id: libraries[0].id, score: 37 }];
  question = normalizePolicyRuntimeQuestion({ metadata: { media_type: 'movie' }, libraries,
    policyResult: { ranked } });
  const metadata = { policyResult: { ranked, thresholds: { prompt: 60, auto_classify: 85 } }, classification_details: {
    candidate_adjudication: { version: 'policy.candidate_adjudication.v1', status_id: 'proposed', candidate_count: 2,
      proposed_destination: { library_id: libraries[1].id, library_name: libraries[1].name } } } };
  row = (await getPool().query(`INSERT INTO classification_history(title,media_type,method,status,confidence,metadata,policy_question)
    VALUES('Synthetic review','movie','signal_calculation','awaiting_decision',37,$1,$2) RETURNING *`, [metadata, question])).rows[0];
  contract = buildPolicyRuntimeQuestionAnswerContract({ classification: row, question });
});
test('locked persisted evidence matches the contract; explicit alternative commits once and exact replay cannot route', async () => {
  expect(contract.recommendation).toMatchObject({ leading_destination: null, policy_destination: { library_id: libraries[0].id, evidence_score: 37 },
    advisory_destination: { library_id: libraries[1].id } });
  const first = await request(app()).post('/answer').send(answer());
  expect(first.status).toBe(200);
  expect(first.body).toMatchObject({ success: true, answerActionId: 'confirm_destination', shouldRoute: true });
  const saved = (await getPool().query('SELECT * FROM classification_history WHERE id=$1', [row.id])).rows[0];
  expect(saved).toMatchObject({ status: 'completed', method: 'manual_classification', library_id: libraries[1].id, policy_question: null });
  const recorded = saved.metadata.classification_details.outcome_link.runtime_question_answer;
  expect(recorded).toMatchObject({ action_id: 'confirm_destination', contract_fingerprint: contract.fingerprint, destination_library_id: libraries[1].id });
  const replay = await request(app()).post('/answer').send(answer());
  expect(replay.status).toBe(200);
  expect(replay.body).toMatchObject({ alreadyResolved: true, idempotent: true, shouldRoute: false });
  expect(routing).toHaveBeenCalledTimes(1);
  const wrong = await request(app()).post('/answer').send(answer('old-presentation-fingerprint'));
  expect(wrong.status).toBe(409);
  expect(routing).toHaveBeenCalledTimes(1);
});
test('changed pending evidence rejects an old fingerprint without updating the row', async () => {
  await getPool().query(`UPDATE classification_history SET metadata=jsonb_set(metadata,
    '{classification_details,candidate_adjudication,proposed_destination,library_id}',to_jsonb($2::int)) WHERE id=$1`, [row.id, libraries[0].id]);
  const response = await request(app()).post('/answer').send(answer());
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('runtime_question_answer_fingerprint_mismatch');
  expect((await getPool().query('SELECT status,library_id FROM classification_history WHERE id=$1', [row.id])).rows[0])
    .toEqual({ status: 'awaiting_decision', library_id: null });
  expect(routing).not.toHaveBeenCalled();
});
test('an acknowledged pre-v2 receipt still replays before current presentation rebuilding', async () => {
  const legacy = answer('old-presentation-fingerprint');
  await getPool().query(`UPDATE classification_history SET status='completed',library_id=$2,policy_question=NULL,
    metadata=jsonb_set(metadata,'{classification_details,outcome_link}',$3::jsonb) WHERE id=$1`, [row.id, libraries[1].id,
    { runtime_question_answer: { contract_version: legacy.contract_version, contract_fingerprint: legacy.contract_fingerprint,
      action_id: legacy.action_id, destination_library_id: libraries[1].id } }]);
  const response = await request(app()).post('/answer').send(legacy);
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({ alreadyResolved: true, idempotent: true, shouldRoute: false });
  expect(routing).not.toHaveBeenCalled();
});
