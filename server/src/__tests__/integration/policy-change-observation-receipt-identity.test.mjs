/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { applyPolicyNativeIntentChange, POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS } =
  await import('../../services/policyNativeIntentChangeService.mjs');
const { createPolicyCandidateCorrectionPolicyChangeOutcomeObservationService: createObservationService } =
  await import('../../services/policyCandidateCorrectionPolicyChangeOutcomeObservationService.mjs');
const { insertPolicyCandidateCorrectionPolicyChangeDecisionRecord: insertDecision } =
  await import('../../services/policyCandidateCorrectionPolicyChangeDecisionRecordPersistence.mjs');
const { registerPolicyCandidateCorrectionPolicyChangeOutcomeObservationRoutes: registerObservationRoutes } =
  await import('../../routes/policiesRoutePolicyChangeOutcomeObservation.mjs');

const path = '/api/policies/candidate-correction/policy-change-outcome-observation';
const now = '2026-11-27T12:00:00.000Z';
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';
const tokens = new Map();

beforeAll(async () => {
  for (const [id, role] of [[7, 'admin'], [8, 'admin'], [9, 'admin'], [10, 'user']]) {
    const username = `receipt-observer-${id}`;
    await db.query(`INSERT INTO users (id, username, password_hash, role)
      VALUES ($1, $2, 'synthetic-test-data', $3)`, [id, username, role]);
    tokens.set(id, await generateAccessToken({ id, username, role }));
  }
});

afterEach(async () => {
  await db.withTransaction(async client => {
    await client.query('DELETE FROM policy_candidate_correction_policy_change_decision_records');
    await client.query('DELETE FROM policy_candidate_correction_policy_change_outcome_observations');
  });
});

function app(at, database = db) {
  const router = express.Router();
  const service = createObservationService({ db: database });
  registerObservationRoutes(router, {
    db: database,
    logger: { info: jest.fn() },
    outcomeObservationService: {
      getOutcomeObservation: input => service.getOutcomeObservation({ ...input, now: at }),
      startOutcomeObservation: input => service.startOutcomeObservation({ ...input, now: at }),
    },
  });
  return createIntegrationTestApp({ basePath: '/api/policies', router, middleware: [authenticateToken] });
}

function call(http, method, actorId) {
  return request(http)[method](path).auth(tokens.get(actorId), { type: 'bearer' });
}

async function applyReceipt(tag, { id, actorId = 7, version = 3, at }) {
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, {
    libraryName: `Observation ${tag}`, policyName: `Observation ${tag}`,
  });
  await db.query(`WITH header AS (
    INSERT INTO policy_intents (policy_id, library_id, intent_version, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 'native_intent', 'inferred', 'valid') RETURNING id
  )
  INSERT INTO policy_intent_rules (intent_id, collection, intent_role, signal_type, operator,
    values, constraint_mode, semantics, source, inference_state)
  SELECT id, 'purpose', 'purpose', 'genres', 'require_any', '{"require_any":["original"]}'::jsonb,
    'advisory', 'identity', 'native_intent', 'inferred' FROM header`, [policyId, libraryId, version]);
  await db.query("SELECT setval(pg_get_serial_sequence('policy_native_intent_change_receipts', 'id'), $1::bigint, false)", [id]);
  const result = await applyPolicyNativeIntentChange({
    dbClient: db,
    policyId,
    expectedRevision: version,
    actorId,
    actorRole: 'admin',
    idempotencyKey: randomUUID(),
    changeCommands: [{ command_id: 'update_purpose', values: [{
      signal_type: 'genres', operator: 'require_any', values: { require_any: ['updated'] },
      constraint_mode: 'advisory', semantics: 'identity',
    }] }],
    now: new Date(at),
  });
  expect(result.statusId).toBe(POLICY_NATIVE_INTENT_CHANGE_RESULT_STATUS_IDS.APPLIED);
  const { rows } = await db.query(`SELECT id, actor_id, source_intent_version, target_intent_version, created_at
    FROM policy_native_intent_change_receipts WHERE policy_id = $1`, [policyId]);
  expect(rows).toEqual([{ id, actor_id: actorId, source_intent_version: version,
    target_intent_version: version + 1, created_at: new Date(at) }]);
}

async function storedObservation() {
  const { rows } = await db.query('SELECT * FROM policy_candidate_correction_policy_change_outcome_observations');
  return rows[0];
}

async function storedDecision() {
  const { rows } = await db.query('SELECT * FROM policy_candidate_correction_policy_change_decision_records');
  return rows[0];
}

test('keeps a safe receipt private and preserves disabled caching and authorization', async () => {
  await applyReceipt('safe', { id: 601, at: '2026-08-10T11:30:00.000Z' });
  const http = app('2026-08-10T12:00:00.000Z');
  await call(http, 'get', 10).expect(403);
  await call(http, 'post', 10).send({}).expect(403);
  await call(http, 'post', 7).send({ receiptId: 601 }).expect(400);
  expect(await storedObservation()).toBeUndefined();
  const read = await call(http, 'get', 7).expect(200).expect('Cache-Control', 'no-store');
  expect(read.body).toMatchObject({ statusId: 'not_started', startAvailable: true });
  const started = await call(http, 'post', 7).send({}).expect(201).expect('Cache-Control', 'no-store');
  expect(started.body).toMatchObject({ operationId: 'observation_started', statusId: 'observing' });
  expect(await storedObservation()).toMatchObject({ source_receipt_id: 601, created_by_actor_id: 7 });
  expect(JSON.stringify(started.body)).not.toMatch(/sourceReceiptId|source_receipt_id|policyId/);
});

test('uses the exact higher actor receipt on a timestamp tie and reuses the active observation', async () => {
  const tiedAt = '2026-11-27T11:30:00.000Z';
  await applyReceipt('lower', { id: lower, at: tiedAt });
  await applyReceipt('upper', { id: upper, version: 4, at: tiedAt });
  await applyReceipt('newer other actor', { id: '9007199254740994', actorId: 8, at: '2026-11-27T11:45:00.000Z' });
  await applyReceipt('future', { id: '9007199254740995', at: '2026-11-27T12:01:00.000Z' });
  await applyReceipt('stale', { id: '9007199254740996', actorId: 9, at: '2026-11-27T10:59:00.000Z' });
  const http = app(now);
  const unavailable = await call(http, 'get', 9).expect(200);
  expect(unavailable.body).toMatchObject({ startAvailable: false });
  const refused = await call(http, 'post', 9).send({}).expect(409);
  expect(refused.body.code).toBe('POLICY_CHANGE_OUTCOME_OBSERVATION_RECEIPT_REQUIRED');
  expect(await storedObservation()).toBeUndefined();
  const available = await call(http, 'get', 7).expect(200).expect('Cache-Control', 'no-store');
  expect(available.body).toMatchObject({ statusId: 'not_started', startAvailable: true });

  const created = await call(http, 'post', 7).send({}).expect(201).expect('Cache-Control', 'no-store');
  const saved = await storedObservation();
  expect(saved).toMatchObject({
    source_receipt_id: upper, source_intent_version: 4, target_intent_version: 5, created_by_actor_id: 7,
  });
  const reused = await call(http, 'post', 9).send({}).expect(200);
  expect(reused.body).toMatchObject({ operationId: 'existing_observation', observation: created.body.observation });
  const loaded = await call(http, 'get', 8).expect(200);
  expect(loaded.body.observation).toEqual(created.body.observation);
  for (const { body } of [available, created, reused, loaded]) {
    expect(JSON.stringify(body)).not.toMatch(/sourceReceiptId|source_receipt_id|policyId|900719925474099[23]/);
  }
  expect(await storedObservation()).toEqual(saved);
});

test('rolls back a substituted receipt and expired decision cleanup, then accepts the BIGINT maximum', async () => {
  const priorNow = '2026-08-01T12:00:00.000Z';
  await applyReceipt('prior observation', { id: 602, at: '2026-08-01T11:30:00.000Z' });
  await call(app(priorNow), 'post', 7).send({}).expect(201);
  const previous = await storedObservation();
  await db.withTransaction(client => insertDecision({
    client,
    record: {
      observationHypothesisId: previous.hypothesis_id,
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_unchanged_or_inconclusive',
      actorId: 7,
      now: previous.followup_window_end_at.toISOString(),
      expiresAt: previous.expires_at.toISOString(),
    },
  }));
  const decision = await storedDecision();
  expect(decision.observation_hypothesis_id).toBe(previous.hypothesis_id);

  const neighbor = '9223372036854775806';
  await applyReceipt('lower maximum', { id: neighbor, actorId: 8, at: now });
  await applyReceipt('maximum', { id: maximum, actorId: 8, version: 5, at: now });
  const eligible = await call(app(now), 'get', 8).expect(200);
  expect(eligible.body).toMatchObject({ statusId: 'expired', startAvailable: true });
  let returned;
  const transactionDb = {
    query: (...args) => db.query(...args),
    withTransaction: work => db.withTransaction(client => work({
      query: async (sql, params) => {
        if (!sql.includes('INSERT INTO policy_candidate_correction_policy_change_outcome_observations')) {
          return client.query(sql, params);
        }
        expect(params[2]).toBe(maximum);
        const changed = [...params];
        changed[2] = neighbor;
        const result = await client.query(sql, changed);
        returned = result.rows[0]?.source_receipt_id;
        return result;
      },
    })),
  };
  const failed = await call(app(now, transactionDb), 'post', 8).send({}).expect(500);
  expect(returned).toBe(neighbor);
  expect(JSON.stringify(failed.body)).not.toContain(neighbor);
  expect(await storedObservation()).toEqual(previous);
  expect(await storedDecision()).toEqual(decision);

  const replaced = await call(app(now), 'post', 8).send({}).expect(201);
  expect(replaced.body.observation.hypothesisId).not.toBe(previous.hypothesis_id);
  expect(await storedObservation()).toMatchObject({
    source_receipt_id: maximum, source_intent_version: 5, target_intent_version: 6, created_by_actor_id: 8,
  });
  expect(await storedDecision()).toBeUndefined();
  expect(JSON.stringify(replaced.body)).not.toContain(maximum);
});
