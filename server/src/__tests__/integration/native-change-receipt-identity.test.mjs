/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';
import { buildPolicyNativeIntentChangeAdmission } from '../../services/policyNativeIntentChangeAdmission.mjs';
import {
  buildPolicyNativeIntentChangeCommandFingerprint,
  buildPolicyNativeIntentChangeReceiptBindingDigest,
  buildPolicyNativeIntentChangeReceiptRecord,
} from '../../services/policyNativeIntentChangeReceiptContract.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { insertNativeIntentChangeEvent } = await import('../../services/policyNativeIntentChangePersistence.mjs');
const { insertPolicyNativeIntentChangeReceipt } = await import('../../services/policyNativeIntentChangeReceiptPersistence.mjs');
const { registerPolicyNativeIntentChangeRoutes } = await import('../../routes/policiesRouteNativeIntentChange.mjs');

const maximum = '9223372036854775807';
const tokens = new Map();
let fixtureSequence = 10000;

beforeAll(async () => {
  for (const id of [7, 8]) {
    const username = `native-change-receipt-admin-${id}`;
    await db.query(`INSERT INTO users (id, username, password_hash, role)
      VALUES ($1, $2, 'synthetic-test-data', 'admin')`, [id, username]);
    tokens.set(id, await generateAccessToken({ id, username, role: 'admin' }));
  }
});

function setNextId(table, id) {
  return db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
}

async function setNextChangeIds({ target, event, receipt }) {
  await setNextId('policy_intents', target);
  await setNextId('policy_intent_migration_events', event);
  await setNextId('policy_native_intent_change_receipts', receipt);
}

async function makePolicy(tag) {
  fixtureSequence += 100;
  await setNextId('policy_intents', fixtureSequence);
  await setNextId('policy_intent_migration_events', fixtureSequence);
  const title = `Native receipt ${tag}`;
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, {
    policyName: title, libraryName: title,
  });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [policyId]);
  const established = await applyPolicyInitialIntentEstablishment({
    dbClient: db, policyId, actorId: 7,
    request: { schema_version: 1, idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['original'] } }] } },
  });
  expect(established.establishment.applied).toBe(true);
  return { policyId, libraryId };
}

function commands(term) {
  return [{ command_id: 'update_purpose', values: [{
    signal_type: 'genres', operator: 'require_any', values: { require_any: [term] },
    constraint_mode: 'advisory', semantics: 'identity',
  }] }];
}

function post({ policyId, key, revision = 1, term = 'updated', actorId = 7, database = db }) {
  const router = express.Router();
  registerPolicyNativeIntentChangeRoutes(router, { db: database, logger: { info: jest.fn() } });
  const app = createIntegrationTestApp({ basePath: '/api/policies', router, middleware: [authenticateToken] });
  return request(app).post(`/api/policies/${policyId}/native-intent/changes`)
    .auth(tokens.get(actorId), { type: 'bearer' }).set('Idempotency-Key', `"${key}"`)
    .send({ expected_revision: revision, change_commands: commands(term) });
}

async function readReceipt(key) {
  const { rows } = await db.query(`SELECT id, target_intent_id, migration_event_id, command_fingerprint
    FROM policy_native_intent_change_receipts WHERE idempotency_key = $1`, [key]);
  return rows[0];
}

async function readState(policyId) {
  const { rows } = await db.query(`SELECT
      (SELECT id FROM policy_intents WHERE policy_id = $1 AND active) AS active_id,
      (SELECT count(*)::int FROM policy_intents WHERE policy_id = $1) AS intents,
      (SELECT count(*)::int FROM policy_intent_migration_events WHERE policy_id = $1) AS events,
      (SELECT count(*)::int FROM policy_native_intent_change_receipts WHERE policy_id = $1) AS receipts`, [policyId]);
  return rows[0];
}

async function makeNeighbor({ policyId, libraryId }, { target, event }, metadata = { appliedCommandIds: ['update_purpose'] }) {
  await db.query(`INSERT INTO policy_intents
    (id, policy_id, library_id, intent_version, active, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 2, false, 'native_intent', 'inferred', 'valid')`, [target, policyId, libraryId]);
  await setNextId('policy_intent_migration_events', event);
  const saved = await db.withTransaction(client => insertNativeIntentChangeEvent({
    client, intentId: target, policyId, actorType: 'operator', actorId: 7, sourceVersion: 1, targetVersion: 2,
    reasonCode: 'native_intent_change', summary: 'Synthetic receipt history', metadata,
  }));
  expect(saved).toBe(event);
}

test.each([
  ['safe', { target: 5001, event: 6001, receipt: 7001 }],
  ['adjacent', { target: '9007199254741001', event: '9007199254742001', receipt: '9007199254743001' }],
  ['maximum', { target: maximum, event: maximum, receipt: maximum }],
])('creates and replays a %s receipt with identical exact links', async (tag, ids) => {
  const item = await makePolicy(tag);
  if (tag === 'adjacent') {
    await makeNeighbor(item, { target: '9007199254741000', event: '9007199254742000' });
  }
  await setNextChangeIds(ids);
  const key = randomUUID();
  const fresh = await post({ policyId: item.policyId, key }).expect(200);
  expect(fresh.body.change).toMatchObject({ applied: true, replayed: false, newIntentId: ids.target, migrationEventId: ids.event });
  const stored = await readReceipt(key);
  expect(stored).toMatchObject({ id: ids.receipt, target_intent_id: ids.target, migration_event_id: ids.event });
  const { rows: [event] } = await db.query('SELECT intent_id, metadata FROM policy_intent_migration_events WHERE id = $1', [ids.event]);
  expect(event).toMatchObject({ intent_id: ids.target, metadata: {
    appliedCommandIds: ['update_purpose'],
    receiptBindingDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
  } });
  expect(JSON.stringify(event.metadata)).not.toContain(key);
  expect(JSON.stringify(event.metadata)).not.toContain(stored.command_fingerprint);
  const before = await readState(item.policyId);
  const replay = await post({ policyId: item.policyId, key }).expect(200);
  expect(replay.body.change).toEqual({ ...fresh.body.change, replayed: true });
  expect(replay.body.sideEffects.databaseWritten).toBe(false);
  expect(replay.body.retry.idempotencyKeyExposed).toBe(false);
  expect(await readState(item.policyId)).toEqual(before);
});

test('reconciles a lost acknowledgement and replays the same links after a later revision', async () => {
  const item = await makePolicy('lost acknowledgement');
  const first = { target: '9007199254744011', event: '9007199254744051', receipt: '9007199254744091' };
  await setNextChangeIds(first);
  const key = randomUUID();
  const acknowledgementLost = {
    withTransaction: async work => {
      await db.withTransaction(work);
      throw new Error('Synthetic lost acknowledgement');
    },
  };
  await post({ policyId: item.policyId, key, database: acknowledgementLost }).expect(503);
  expect(await readReceipt(key)).toMatchObject({ id: first.receipt, target_intent_id: first.target, migration_event_id: first.event });
  await post({ policyId: item.policyId, key, actorId: 8 }).expect(422);
  await post({ policyId: item.policyId, key, term: 'different' }).expect(422);
  const retry = await post({ policyId: item.policyId, key }).expect(200);
  expect(retry.body.change).toMatchObject({ replayed: true, newIntentId: first.target, migrationEventId: first.event });

  const second = { target: 5100, event: 6100, receipt: 7100 };
  await setNextChangeIds(second);
  await post({ policyId: item.policyId, key: randomUUID(), revision: 2, term: 'later' }).expect(200);
  const before = await readState(item.policyId);
  const historical = await post({ policyId: item.policyId, key }).expect(200);
  expect(historical.body.change).toEqual(retry.body.change);
  expect(await readState(item.policyId)).toEqual({ ...before, active_id: second.target, receipts: 2 });
});

test('rolls back real event and receipt writes with substituted links or evidence', async () => {
  const item = await makePolicy('transaction acknowledgement');
  const ids = { target: '9007199254745001', event: '9007199254745021', receipt: '9007199254745041' };
  const neighbor = { target: '9007199254745000', event: '9007199254745020' };
  await makeNeighbor(item, neighbor);
  const initial = await readState(item.policyId);
  for (const [table, position, value, returned] of [
    ['policy_intent_migration_events', 0, neighbor.target, { intent_id: neighbor.target }],
    ['policy_intent_migration_events', 8, JSON.stringify({ receiptBindingDigest: 'f'.repeat(64) }),
      { receipt_binding_digest: 'f'.repeat(64) }],
    ['policy_native_intent_change_receipts', 6, neighbor.target, { target_intent_id: neighbor.target }],
    ['policy_native_intent_change_receipts', 8, neighbor.event, { migration_event_id: neighbor.event }],
  ]) {
    await setNextChangeIds(ids);
    let saved;
    const database = { withTransaction: work => db.withTransaction(client => work({
      query: async (sql, params) => {
        if (!sql.includes(`INSERT INTO ${table}`)) return client.query(sql, params);
        const changed = [...params];
        changed[position] = value;
        const result = await client.query(sql, changed);
        saved = result.rows[0];
        return result;
      },
    })) };
    const key = randomUUID();
    await post({ policyId: item.policyId, key, database }).expect(503);
    expect(saved).toMatchObject(returned);
    expect(await readReceipt(key)).toBeUndefined();
    expect(await readState(item.policyId)).toEqual(initial);
  }
});

test.each([
  ['safe links', { target: 8011, event: 8012, receipt: '9007199254745601' }, 'missing', 200],
  ['historical large links', { target: '9007199254746000', event: '9007199254746020', receipt: 8021 }, 'missing', 503],
  ['other attempt', { target: '9007199254746100', event: '9007199254746120', receipt: 8022 }, 'different', 503],
])('handles legacy replay with %s without starting another mutation', async (tag, ids, proof, status) => {
  const item = await makePolicy(tag);
  const key = randomUUID();
  const admitted = buildPolicyNativeIntentChangeAdmission({
    policyId: item.policyId, actorId: 7, actorRole: 'admin', expectedRevision: 1, idempotencyKey: key, changeCommands: commands('updated'),
  });
  expect(admitted.admitted).toBe(true);
  const commandFingerprint = buildPolicyNativeIntentChangeCommandFingerprint({
    policyId: item.policyId, actorId: 7, expectedRevision: 1, changeCommands: admitted.admittedCommands,
  });
  const metadata = { appliedCommandIds: ['update_purpose'] };
  if (proof === 'different') {
    metadata.receiptBindingDigest = buildPolicyNativeIntentChangeReceiptBindingDigest({
      idempotencyKey: randomUUID(), commandFingerprint, targetIntentId: ids.target,
    });
  }
  await makeNeighbor(item, ids, metadata);
  await setNextId('policy_native_intent_change_receipts', ids.receipt);
  await db.withTransaction(client => insertPolicyNativeIntentChangeReceipt({ client, receipt: buildPolicyNativeIntentChangeReceiptRecord({
    policyId: item.policyId, actorId: 7, idempotencyKey: key, commandFingerprint, sourceIntentVersion: 1,
    targetIntentId: ids.target, targetIntentVersion: 2, migrationEventId: ids.event,
    appliedCommandIds: ['update_purpose'], createdAt: new Date(),
  }) }));
  const stored = await readReceipt(key);
  const before = await readState(item.policyId);
  const response = await post({ policyId: item.policyId, key }).expect(status);
  if (status === 200) {
    expect(response.body.change).toMatchObject({ replayed: true, newIntentId: ids.target, migrationEventId: ids.event });
  } else {
    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_CHANGE_UNAVAILABLE');
  }
  expect(await readReceipt(key)).toEqual(stored);
  expect(await readState(item.policyId)).toEqual(before);
});
