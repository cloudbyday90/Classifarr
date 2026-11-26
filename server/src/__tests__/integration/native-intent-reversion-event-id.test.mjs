/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { applyPolicyNativeIntentReversion } = await import('../../services/policyNativeIntentReversionService.mjs');
const { nativeIntentReconciliationLifecycleService: lifecycle } =
  await import('../../services/nativeIntentReconciliationLifecycleService.mjs');
const { registerPolicyNativeIntentReversionRoutes } = await import('../../routes/policiesRouteNativeIntentReversion.mjs');
const { registerPolicyNativeIntentReconciliationRoutes } =
  await import('../../routes/policiesRouteNativeIntentReconciliation.mjs');

const router = express.Router();
const logger = { info: jest.fn() };
registerPolicyNativeIntentReversionRoutes(router, { db, logger });
registerPolicyNativeIntentReconciliationRoutes(router, { db, logger });
const app = createIntegrationTestApp({ basePath: '/api/policies', router, middleware: [authenticateToken] });
const action = { actorId: 7, actorSourceId: 'manual_operator', reasonCode: 'operator_reviewed' };
let adminToken;
let memberToken;
let originalSequence;

beforeAll(async () => {
  adminToken = await generateAccessToken({ id: 7, username: 'fixture-admin', role: 'admin' });
  memberToken = await generateAccessToken({ id: 8, username: 'fixture-member', role: 'user' });
});

beforeEach(async () => {
  const { rows: [sequence] } = await db.query('SELECT last_value::text AS value, is_called FROM policy_intent_migration_events_id_seq');
  originalSequence = sequence;
});

afterEach(async () => {
  await setEventSequence(originalSequence.value, originalSequence.is_called);
});

async function setEventSequence(id, isCalled = false) {
  await db.query("SELECT setval(pg_get_serial_sequence('policy_intent_migration_events', 'id'), $1, $2)", [id, isCalled]);
}

async function seedSnapshot(label) {
  return db.withTransaction(async client => {
    const { rows: [library] } = await client.query(`
      INSERT INTO libraries (external_id, name, media_type) VALUES ($1, $1, 'movie') RETURNING id
    `, [label]);
    const { rows: [policy] } = await client.query(`
      INSERT INTO library_policies (library_id, name) VALUES ($1, $2) RETURNING id
    `, [library.id, label]);
    const { rows: [intent] } = await client.query(`
      INSERT INTO policy_intents (policy_id, library_id, schema_version, intent_version, active,
        source, inference_state, review_behavior, validation_status)
      VALUES ($1, $2, 1, 1, TRUE, 'native_intent', 'inferred', '{}', 'valid') RETURNING id
    `, [policy.id, library.id]);
    await client.query(`
      INSERT INTO policy_intent_rules (intent_id, intent_role, collection, signal_type, operator,
        values, constraint_mode, semantics, source, inference_state, sort_order)
      VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', '{"require_any":["Animation"]}',
        'advisory', 'identity', 'operator_declared_intent', 'inferred', 0)
    `, [intent.id]);
    const manifest = {
      policy_id: policy.id, library_id: library.id, legacy_policy: {}, presets: [], routing_target: null,
      restore_sections: ['preset_attachments', 'weights', 'thresholds', 'custom_signals',
        'routing_mapping_references', 'migration_actor', 'migration_reason'],
    };
    const { rows: [snapshot] } = await client.query(`
      INSERT INTO policy_intent_rollback_snapshots (intent_id, policy_id, snapshot_version, snapshot_payload,
        payload_redacted, restore_path, expires_at)
      VALUES ($1, $2, 1, $3::jsonb, FALSE, $4, NOW() + INTERVAL '1 day') RETURNING id
    `, [intent.id, policy.id, manifest, label]);
    return { policyId: policy.id, snapshotId: snapshot.id };
  });
}

async function seedEvent(id, policyId, eventType) {
  await db.query(`
    INSERT INTO policy_intent_migration_events (id, policy_id, event_type, actor_type, reason_code)
    VALUES ($1, $2, $3, 'test_fixture', 'identity_fixture')
  `, [id, policyId, eventType]);
}

async function readState({ policyId, snapshotId }) {
  const { rows: [state] } = await db.query(`
    SELECT i.active, s.restored_at IS NOT NULL AS restored, h.hold_state, h.source_event_id, h.released_event_id
    FROM policy_intent_rollback_snapshots s JOIN policy_intents i ON i.id = s.intent_id
    LEFT JOIN policy_native_intent_reconciliation_holds h ON h.policy_id = $1 WHERE s.id = $2
  `, [policyId, snapshotId]);
  return state;
}

test.each([
  [101, 102],
  ['9007199254740993', '9007199254740994'],
  ['9223372036854775807', '9223372036854775806'],
])('preserves the rollback event %p through reversion, hold selection, and reentry', async (sourceId, releaseId) => {
  const fixture = await seedSnapshot(`reversion-${sourceId}`);
  if (sourceId === '9007199254740993') {
    const neighbor = await seedSnapshot('reversion-neighbor');
    await seedEvent('9007199254740992', neighbor.policyId, 'dry_run_reported');
  }

  const { policyId, snapshotId } = fixture;
  const reversionPath = `/api/policies/${policyId}/native-intent-rollbacks/${snapshotId}/apply`;
  const reentryPath = `/api/policies/${policyId}/native-intent-reconciliation/reentry`;
  const post = (path, token = adminToken) => request(app).post(path).set('Authorization', `Bearer ${token}`)
    .send({ reason_code: action.reasonCode });

  await setEventSequence(sourceId);
  await post(reversionPath, memberToken).expect(403);
  const applied = await post(reversionPath).expect(200);
  expect(applied.body).toMatchObject({ statusId: 'applied_to_compatibility', policyId, snapshotId });
  expect(await readState(fixture)).toMatchObject({ active: false, restored: true, hold_state: 'active', source_event_id: sourceId });

  const partition = await lifecycle.partitionCandidates({ dbClient: db, candidates: [{ policyId }] });
  expect(partition.eligibleCandidates).toEqual([]);
  expect(partition.heldCandidates).toMatchObject([{ policyId, hold: { sourceEventId: sourceId } }]);
  expect((await post(reversionPath).expect(200)).body.statusId).toBe('already_reverted');

  // The maximum source ID exhausts its sequence. Allocate the separate audit event explicitly in the fixture.
  await setEventSequence(releaseId);
  await post(reentryPath, memberToken).expect(403);
  const approved = await post(reentryPath).expect(200);
  expect(approved.body).toMatchObject({ approved: true, policyId });
  expect(await readState(fixture)).toMatchObject({ hold_state: 'released', source_event_id: sourceId, released_event_id: releaseId });
  const { rows } = await db.query(`
    SELECT id, event_type, actor_id, metadata FROM policy_intent_migration_events WHERE policy_id = $1 ORDER BY created_at
  `, [policyId]);
  expect(rows).toEqual([
    expect.objectContaining({ id: sourceId, event_type: 'rollback_applied', actor_id: action.actorId }),
    expect.objectContaining({ id: releaseId, event_type: 'reconciliation_reentry_approved', actor_id: action.actorId,
      metadata: { heldEventId: sourceId } }),
  ]);
  await post(reentryPath).expect(409);
});

test('rejects a wrong-policy or wrong-kind source without leaving a partial reversion', async () => {
  const fixture = await seedSnapshot('reversion-failed-binding');
  const other = await seedSnapshot('reversion-other-policy');
  await seedEvent(301, other.policyId, 'rollback_applied');
  await seedEvent(302, fixture.policyId, 'dry_run_reported');
  await expect(db.withTransaction(client => lifecycle.recordReversionHold({
    client, policyId: fixture.policyId, sourceEventId: 302,
  }))).rejects.toThrow('hold could not be persisted');

  await setEventSequence(303);
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query(sql, params) {
      if (sql.includes('INSERT INTO policy_native_intent_reconciliation_holds')) {
        return client.query(sql, [params[0], 301, ...params.slice(2)]);
      }
      return client.query(sql, params);
    },
  })) };
  const result = await applyPolicyNativeIntentReversion({ dbClient, ...fixture, action });
  expect(result.statusId).toBe('failed_rolled_back');
  expect(await readState(fixture)).toMatchObject({ active: true, restored: false, hold_state: null });
  expect((await db.query('SELECT id FROM policy_intent_migration_events WHERE id = 303')).rows).toEqual([]);
});
