/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { registerPolicyInitialIntentEstablishmentRoutes } = await import('../../routes/policiesRouteInitialIntentEstablishment.mjs');
const { registerPolicyInitialIntentEstablishmentReadinessRoutes } = await import('../../routes/policiesRouteInitialIntentEstablishmentReadiness.mjs');
const { registerPolicyNativeIntentReversionRoutes } = await import('../../routes/policiesRouteNativeIntentReversion.mjs');
const { registerPolicyWriteRoutes } = await import('../../routes/policiesRoutePolicyWrite.mjs');
const { loadHeldOutSemanticStudyLifecycleReauditSourceRecord } = await import('../../services/heldOutSemanticStudyLifecycleReauditSource.mjs');
const { PolicyRollbackSnapshotRetentionService } = await import('../../services/policyRollbackSnapshotRetentionService.mjs');

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const basePath = '/api/policies';
const establishmentPath = policyId => `${basePath}/${policyId}/native-intent/initial-establishment`;
let adminToken;
let memberToken;

function app(database = db) {
  const router = express.Router();
  const deps = { db: database, logger, DEFAULT_POLICY_AUTO_CLASSIFY_THRESHOLD: 85, DEFAULT_POLICY_PROMPT_THRESHOLD: 60 };
  registerPolicyInitialIntentEstablishmentRoutes(router, deps);
  registerPolicyInitialIntentEstablishmentReadinessRoutes(router, deps);
  registerPolicyNativeIntentReversionRoutes(router, deps);
  registerPolicyWriteRoutes(router, deps);
  return createIntegrationTestApp({ basePath, router, middleware: [authenticateToken] });
}

beforeAll(async () => {
  await db.query(`INSERT INTO users (id, username, password_hash, role)
    VALUES (7, 'receipt-admin', 'synthetic-not-a-credential', 'admin') ON CONFLICT (id) DO NOTHING`);
  adminToken = await generateAccessToken({ id: 7, username: 'receipt-admin', role: 'admin' });
  memberToken = await generateAccessToken({ id: 8, username: 'receipt-member', role: 'user' });
});

async function fixture(rule) {
  const name = `Receipt ${rule}`;
  const policy = await createPolicyEngineIntegrationFixture(db, { policyName: name, libraryName: name });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policy.policyId]);
  return {
    ...policy,
    body: {
      schema_version: 1,
      idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: [rule] } }] },
    },
  };
}

async function setNextReceiptIds({ id, intentId, rollbackSnapshotId }) {
  // Each test seeds its own ID range in this suite's disposable database.
  for (const [table, value] of [
    ['policy_initial_intent_establishments', id],
    ['policy_intents', intentId],
    ['policy_intent_rollback_snapshots', rollbackSnapshotId],
  ]) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, value]);
  }
}

function establish(value, database = db, token = adminToken) {
  return request(app(database)).post(establishmentPath(value.policyId)).auth(token, { type: 'bearer' }).send(value.body);
}

function readiness(policyId, token = adminToken) {
  return request(app()).get(`${establishmentPath(policyId)}/readiness`).auth(token, { type: 'bearer' });
}

async function expectStoredReceipt(policyId, ids) {
  const { rows } = await db.query(`SELECT id, intent_id, rollback_snapshot_id
    FROM policy_initial_intent_establishments WHERE policy_id = $1`, [policyId]);
  expect(rows).toEqual([{ id: ids.id, intent_id: ids.intentId, rollback_snapshot_id: ids.rollbackSnapshotId }]);
}

async function expectReadiness(policyId, ids, rule) {
  const { body } = await readiness(policyId).expect(200);
  expect(body.statusId).toBe('initial_intent_establishment_recorded');
  expect(body.establishmentHistory).toMatchObject({
    establishment: { id: ids.id, intentId: ids.intentId },
    recovery: { snapshotId: ids.rollbackSnapshotId, rollbackAvailable: true },
  });
  expect(body.declaredRuleSummary.declaredIntent.purpose[0].values.include).toEqual([rule]);
  return body.establishmentHistory.recovery.snapshotId;
}

test('preserves numeric receipt IDs and existing administrator access', async () => {
  const ids = { id: 401, intentId: 501, rollbackSnapshotId: 601 };
  await setNextReceiptIds(ids);
  const value = await fixture('safe');
  await establish(value, db, memberToken).expect(403);
  await readiness(value.policyId, memberToken).expect(403);
  const applied = await establish(value).expect(201);
  expect(applied.body.establishment).toMatchObject({ ...ids, applied: true });
  const replay = await establish(value).expect(200);
  expect(replay.body.establishment).toMatchObject({ ...ids, replayed: true });
  await expectStoredReceipt(value.policyId, ids);
  await expectReadiness(value.policyId, ids, 'safe');
});

test('recovers the exact adjacent receipt and uses its readiness snapshot for rollback', async () => {
  const lower = { id: '9007199254741004', intentId: '9007199254740992', rollbackSnapshotId: '9007199254740996' };
  const upper = { id: '9007199254741005', intentId: '9007199254740993', rollbackSnapshotId: '9007199254740997' };
  await setNextReceiptIds(lower);
  const neighbor = await fixture('lower');
  const next = await fixture('upper');
  const lowerResponse = await establish(neighbor).expect(201);
  const unknown = await establish(next, {
    withTransaction: async work => {
      await db.withTransaction(work);
      throw new Error('Synthetic lost COMMIT acknowledgement');
    },
  }).expect(503);
  expect(unknown.body.code).toBe('POLICY_INITIAL_INTENT_ESTABLISHMENT_UNAVAILABLE');
  const replay = await establish(next).expect(200);
  expect(replay.body.establishment).toMatchObject({ ...upper, replayed: true });
  await expectStoredReceipt(next.policyId, upper);
  const snapshotId = await expectReadiness(next.policyId, upper, 'upper');
  expect(lowerResponse.body.establishment).toMatchObject(lower);
  await expectReadiness(neighbor.policyId, lower, 'lower');

  const result = await request(app()).post(`${basePath}/${next.policyId}/native-intent-rollbacks/${snapshotId}/apply`)
    .auth(adminToken, { type: 'bearer' }).send({ reason_code: 'operator_reviewed' }).expect(200);
  expect(result.body).toMatchObject({ statusId: 'applied_to_compatibility', snapshotId: upper.rollbackSnapshotId });
  const { body } = await readiness(next.policyId).expect(200);
  expect(body.establishmentHistory.recovery).toMatchObject({ stateId: 'reverted', snapshotId });
  await expectReadiness(neighbor.policyId, lower, 'lower');
});

test('preserves the BIGINT maximum in native create, replay and readiness', async () => {
  const maximum = '9223372036854775807';
  const ids = { id: maximum, intentId: maximum, rollbackSnapshotId: maximum };
  const before = await loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db });
  await setNextReceiptIds(ids);
  await db.query("SELECT setval(pg_get_serial_sequence('policy_intent_migration_events', 'id'), $1::bigint, false)", [maximum]);
  const value = await fixture('maximum');
  await db.query('DELETE FROM library_policies WHERE id = $1', [value.policyId]);
  const create = () => request(app()).post(basePath).auth(adminToken, { type: 'bearer' })
    .set('Idempotency-Key', `"${value.body.idempotency_key}"`)
    .send({
      library_id: value.libraryId,
      name: `Receipt ${value.body.idempotency_key}`,
      native_intent_establishment: { declared_intent: value.body.declared_intent },
    });
  const created = await create().expect(201);
  expect(created.body.native_intent_establishment.intentId).toBe(maximum);
  const related = await db.query(
    'SELECT migration_event_id FROM policy_initial_intent_establishments WHERE policy_id = $1', [created.body.id],
  );
  expect(related.rows).toEqual([{ migration_event_id: maximum }]);
  const after = await loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db });
  expect(after.initial_intent_establishment_count).toBe(before.initial_intent_establishment_count + 1);
  // Later independent tests use the same disposable sequence.
  await db.query("SELECT setval(pg_get_serial_sequence('policy_intent_migration_events', 'id'), 5000, false)");
  const replay = await create().expect(200);
  expect(replay.body.id).toBe(created.body.id);
  expect(replay.body.native_intent_establishment.intentId).toBe(maximum);
  const original = await establish({ ...value, policyId: created.body.id }).expect(200);
  expect(original.body.establishment).toMatchObject({ ...ids, replayed: true });
  await expectStoredReceipt(created.body.id, ids);
  await expectReadiness(created.body.id, ids, 'maximum');
  const { rows: [snapshot] } = await db.query(
    'SELECT expires_at FROM policy_intent_rollback_snapshots WHERE id = $1', [maximum],
  );
  const retention = new PolicyRollbackSnapshotRetentionService({ db, logger, lockKey: 2007 });
  expect(await retention.cleanup({ now: snapshot.expires_at })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: expect.arrayContaining([maximum]),
  });
  const { rows } = await db.query(`SELECT
    snapshot_payload #> '{retention_marker,source_audit,migration_event_id}' AS verified_event_id
    FROM policy_intent_rollback_snapshots WHERE id = $1`, [maximum]);
  expect(rows).toEqual([{ verified_event_id: maximum }]);
});

test.each([
  [701, 'INSERT INTO policy_initial_intent_establishments', 9007199254740992],
  [702, 'INSERT INTO policy_intents', 9007199254740992],
  [703, 'INSERT INTO policy_intent_rollback_snapshots', 9007199254740992],
  [704, 'UPDATE policy_initial_intent_establishments', 705],
  [706, 'INSERT INTO policy_initial_intent_establishments', null],
])('rolls back the transition when receipt %s receives an invalid acknowledgement', async (id, statement, returnedId) => {
  await setNextReceiptIds({ id, intentId: id, rollbackSnapshotId: id });
  const value = await fixture(`invalid-${id}`);
  const database = { withTransaction: work => db.withTransaction(client => work({
    query: async (sql, params) => {
      const result = await client.query(sql, params);
      if (!sql.includes(statement)) return result;
      return { ...result, rows: returnedId === null ? [] : [{ id: returnedId }] };
    },
  })) };
  await establish(value, database).expect(503);
  const { rows } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM policy_initial_intent_establishments WHERE policy_id = $1) AS receipts,
    (SELECT COUNT(*)::int FROM policy_intents WHERE policy_id = $1) AS intents,
    (SELECT COUNT(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $1) AS snapshots,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events`, [value.policyId]);
  expect(rows).toEqual([{ receipts: 0, intents: 0, snapshots: 0, events: 0 }]);
});
