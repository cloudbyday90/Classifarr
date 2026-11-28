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
const { registerPolicyInitialIntentEstablishmentReadinessRoutes } = await import('../../routes/policiesRouteInitialIntentEstablishmentReadiness.mjs');
const { registerPolicyNativeIntentReversionRoutes } = await import('../../routes/policiesRouteNativeIntentReversion.mjs');
const { generateAccessToken } = await import('../../services/auth.mjs');
const { applyPolicyInitialIntentEstablishment } = await import('../../services/policyInitialIntentEstablishmentService.mjs');
const { clearExistingConfig, restoreAllTables } = await import('../../services/backupRestore.mjs');
const { collectBackupSnapshot } = await import('../../services/backupSnapshot.mjs');
const { PolicyRollbackSnapshotRetentionService } = await import('../../services/policyRollbackSnapshotRetentionService.mjs');

const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';
const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
const retention = new PolicyRollbackSnapshotRetentionService({ db, logger, lockKey: 2007 });
let admin;

beforeAll(async () => {
  await db.query("INSERT INTO users (id, username, password_hash, role) VALUES (7, 'retention-admin', 'synthetic', 'admin')");
  const token = await generateAccessToken({ id: 7, username: 'retention-admin', role: 'admin' });
  const router = express.Router();
  registerPolicyInitialIntentEstablishmentReadinessRoutes(router, { db, logger });
  registerPolicyNativeIntentReversionRoutes(router, { db, logger });
  const app = createIntegrationTestApp({ basePath: '/api/policies', router, middleware: [authenticateToken] });
  admin = request.agent(app).auth(token, { type: 'bearer' });
});
afterEach(() => db.withTransaction(clearExistingConfig));

function setNextId(table, id) {
  return db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
}

function establish({ policyId, request }) {
  return applyPolicyInitialIntentEstablishment({ dbClient: db, policyId, actorId: 7, request });
}

async function seed(name, snapshotId, eventId) {
  const fixture = await createPolicyEngineIntegrationFixture(db, { policyName: name, libraryName: name });
  await db.query('DELETE FROM policy_presets WHERE policy_id = $1', [fixture.policyId]);
  await setNextId('policy_intent_rollback_snapshots', snapshotId);
  await setNextId('policy_intent_migration_events', eventId);
  const input = {
    ...fixture, request: {
      schema_version: 1, idempotency_key: randomUUID(),
      declared_intent: { purpose: [{ signal_type: 'genres', operator: 'include', values: { include: ['Animation'] } }] },
    },
  };
  expect((await establish(input)).establishment).toMatchObject({ applied: true, rollbackSnapshotId: snapshotId });
  return input;
}

function snapshots() {
  return db.query(`SELECT snapshot.id, snapshot.intent_id, snapshot.policy_id, snapshot.expires_at,
    snapshot.payload_redacted, snapshot.snapshot_payload, receipt.migration_event_id
    FROM policy_intent_rollback_snapshots snapshot
    LEFT JOIN policy_initial_intent_establishments receipt ON receipt.rollback_snapshot_id = snapshot.id
    ORDER BY snapshot.id`).then(({ rows }) => rows);
}

async function redact(eligible) {
  const now = new Date(Math.max(...eligible.map(row => row.expires_at.getTime())));
  expect(await retention.cleanup({ now })).toMatchObject({
    statusId: 'completed', redactedSnapshotCount: eligible.filter(row => row.payload_redacted === false).length,
  });
  const { rows } = await db.query(`SELECT metadata -> 'snapshotId' AS snapshot_id,
    metadata -> 'sourceAuditEventId' AS source_event_id
    FROM policy_intent_migration_events WHERE event_type = 'rollback_snapshot_payload_redacted'`);
  return new Map(rows.map(row => [row.snapshot_id, row.source_event_id]));
}

function expectedSource(id) {
  return {
    migration_event_id: id,
    actor_type: id === null ? null : 'operator',
    actor_id: id === null ? null : 7,
    actor_source_id: null,
    reason_code: id === null ? null : 'operator_declared_initial_intent',
  };
}

function auditSource(snapshot) {
  return snapshot.snapshot_payload.retention_marker.source_audit;
}

async function exportArchive() {
  return JSON.parse(JSON.stringify(await collectBackupSnapshot({ includePatterns: false })));
}

async function restore(archive, mode, firstSnapshotId, firstEventId) {
  await setNextId('policy_intent_rollback_snapshots', firstSnapshotId);
  await setNextId('policy_intent_migration_events', firstEventId);
  return db.withTransaction(client => restoreAllTables(client, archive, mode));
}

function revert(policyId, snapshotId) {
  return admin.post(`/api/policies/${policyId}/native-intent-rollbacks/${snapshotId}/apply`)
    .send({ reason_code: 'operator_reviewed' });
}

async function readReadiness(policyId) {
  const { body } = await admin.get(`/api/policies/${policyId}/native-intent/initial-establishment/readiness`).expect(200);
  return body;
}

async function expectReversionBlocked(policyId, snapshotId, riskId = 'snapshot_not_restorable') {
  const { body } = await revert(policyId, snapshotId).expect(409);
  expect(body).toMatchObject({
    code: 'POLICY_NATIVE_INTENT_REVERSION_BLOCKED',
    reversion: { snapshotId, validation: { issues: [{ riskId }] } },
  });
}

async function reversionState(policyId) {
  const [intents, snapshots, events, holds] = await Promise.all([
    db.query('SELECT id, active, replaced_by_intent_id FROM policy_intents WHERE policy_id = $1 ORDER BY id', [policyId]),
    db.query('SELECT id, restored_at FROM policy_intent_rollback_snapshots WHERE policy_id = $1 ORDER BY id', [policyId]),
    db.query(`SELECT id, intent_id, metadata FROM policy_intent_migration_events
      WHERE policy_id = $1 AND event_type = 'rollback_applied' ORDER BY id`, [policyId]),
    db.query('SELECT hold_state, source_event_id FROM policy_native_intent_reconciliation_holds WHERE policy_id = $1', [policyId]),
  ]);
  return { intents: intents.rows, snapshots: snapshots.rows, events: events.rows, holds: holds.rows };
}

test('uses the receipt-backed snapshot for reversion after merge and preserves verified completed replay', async () => {
  const { policyId } = await seed('Initial rollback command', lower, 801);
  await restore(await exportArchive(), 'merge', upper, 1800);
  const listed = await readReadiness(policyId);
  expect(listed.establishmentHistory.recovery).toMatchObject({ snapshotId: lower, rollbackAvailable: true });

  const before = await reversionState(policyId);
  expect(before.snapshots).toEqual([{ id: lower, restored_at: null }, { id: upper, restored_at: null }]);
  await expectReversionBlocked(policyId, upper);
  expect(await reversionState(policyId)).toEqual(before);

  await db.query('UPDATE policy_intent_rollback_snapshots SET restored_at = NOW() WHERE id = $1', [upper]);
  const history = await reversionState(policyId);
  await expectReversionBlocked(policyId, upper);
  expect(await reversionState(policyId)).toEqual(history);

  expect((await revert(policyId, lower).expect(200)).body).toMatchObject({
    statusId: 'applied_to_compatibility', snapshotId: lower,
  });
  const applied = await reversionState(policyId);
  expect(applied.intents).toEqual([{ ...before.intents[0], active: false }]);
  expect(applied.snapshots).toEqual([{ id: lower, restored_at: expect.any(Date) }, history.snapshots[1]]);
  expect(applied.events).toEqual([{
    id: expect.any(Number), intent_id: before.intents[0].id, metadata: expect.objectContaining({ snapshotId: lower }),
  }]);
  expect(applied.holds).toEqual([{ hold_state: 'active', source_event_id: applied.events[0].id }]);

  await db.query(`UPDATE policy_intent_rollback_snapshots
    SET expires_at = date_trunc('milliseconds', NOW()) WHERE policy_id = $1`, [policyId]);
  await redact(await snapshots());
  expect((await snapshots()).map(snapshot => snapshot.payload_redacted)).toEqual([true, true]);
  expect((await readReadiness(policyId)).establishmentHistory.recovery).toMatchObject({
    stateId: 'reverted', snapshotId: lower, rollbackAvailable: false, restoredAt: expect.any(String),
  });
  expect((await revert(policyId, lower).expect(200)).body).toMatchObject({
    statusId: 'already_reverted', snapshotId: lower,
  });
  expect(await reversionState(policyId)).toEqual(applied);
});

test('requires event proof for a claimed snapshot regardless of its stored path', async () => {
  const { policyId } = await seed('Initial rollback invalid event', maximum, 801);
  await db.query("UPDATE policy_intent_rollback_snapshots SET restore_path = 'historical/path' WHERE id = $1", [maximum]);
  await db.query("UPDATE policy_intent_migration_events SET metadata = metadata - 'request_fingerprint' WHERE id = 801");
  await db.query('UPDATE policy_intent_rollback_snapshots SET restored_at = NOW() WHERE id = $1', [maximum]);
  const before = await reversionState(policyId);
  const readiness = await readReadiness(policyId);
  expect(readiness.statusId).toBe('initial_intent_establishment_recovery_attention_required');
  expect(readiness.establishmentHistory.recovery).toMatchObject({
    stateId: 'rollback_proof_unverified', snapshotId: maximum, rollbackAvailable: false, restoredAt: null,
  });
  await expectReversionBlocked(policyId, maximum);
  expect(await reversionState(policyId)).toEqual(before);
});

test('does not offer initial reversion after a successor replaced its authority', async () => {
  const { policyId, libraryId } = await seed('Initial rollback inactive authority', 701, 801);
  await db.withTransaction(async client => {
    await client.query('UPDATE policy_intents SET active = FALSE WHERE policy_id = $1', [policyId]);
    const { rows: [successor] } = await client.query(`
      INSERT INTO policy_intents (policy_id, library_id, schema_version, intent_version,
        active, source, inference_state, review_behavior, validation_status)
      VALUES ($1, $2, 1, 2, TRUE, 'native_intent', 'inferred', '{}', 'valid') RETURNING id`, [policyId, libraryId]);
    await client.query(`
      INSERT INTO policy_intent_rules (intent_id, intent_role, collection, signal_type, operator,
        values, constraint_mode, semantics, source, inference_state, sort_order)
      VALUES ($1, 'purpose', 'purpose', 'genres', 'require_any', '{"require_any":["Animation"]}',
        'advisory', 'identity', 'operator_declared_intent', 'inferred', 0)`, [successor.id]);
    await client.query('UPDATE policy_intents SET replaced_by_intent_id = $2 WHERE policy_id = $1 AND intent_version = 1',
      [policyId, successor.id]);
  });
  const before = await reversionState(policyId);
  expect((await readReadiness(policyId)).establishmentHistory.recovery).toMatchObject({
    stateId: 'native_intent_inactive', snapshotId: 701, rollbackAvailable: false,
  });
  await expectReversionBlocked(policyId, 701, 'authority_mismatch');
  expect(await reversionState(policyId)).toEqual(before);
});

test('preserves the historical manifest through replace and reports the remapped snapshot as unavailable', async () => {
  const archivedOwner = await seed('Initial rollback owner remap', lower, 801);
  const archive = await exportArchive();
  const [archived] = await snapshots();
  const policyId = 4800;
  const libraryId = 4700;
  await setNextId('libraries', libraryId);
  await setNextId('library_policies', policyId);
  await restore(archive, 'replace', upper, 4900);
  expect(await snapshots()).toMatchObject([{ id: upper, policy_id: policyId, migration_event_id: 4900 }]);
  const [restored] = await snapshots();
  expect(restored.snapshot_payload).toEqual(archived.snapshot_payload);
  expect(restored.snapshot_payload).toMatchObject({ policy_id: archivedOwner.policyId, library_id: archivedOwner.libraryId });
  const before = await reversionState(policyId);
  const readiness = await readReadiness(policyId);
  expect(readiness.statusId).toBe('initial_intent_establishment_recovery_attention_required');
  expect(readiness.establishmentHistory.recovery).toMatchObject({
    stateId: 'rollback_manifest_invalid', snapshotId: upper, rollbackAvailable: false,
  });
  expect(readiness.declaredRuleSummary.stateId).toBe('available');
  expect(JSON.stringify(readiness)).not.toMatch(/snapshot_payload|request_fingerprint|accepted_by/);
  await expectReversionBlocked(policyId, upper, 'snapshot_manifest_invalid');
  expect(await reversionState(policyId)).toEqual(before);
  expect((await snapshots())[0].snapshot_payload).toEqual(archived.snapshot_payload);
});

test('uses the same typed owner checks for readiness and reversion', async () => {
  const { policyId, libraryId } = await seed('Initial rollback typed manifest', 701, 801);
  const [{ snapshot_payload: manifest }] = await snapshots();
  const saveManifest = overrides => db.query('UPDATE policy_intent_rollback_snapshots SET snapshot_payload = $1::jsonb WHERE id = 701',
    [JSON.stringify({ ...manifest, ...overrides })]);

  for (const invalid of [
    { policy_id: [policyId] },
    { library_id: `0${libraryId}` },
    { restore_sections: manifest.restore_sections.slice(1) },
  ]) {
    await saveManifest(invalid);
    expect((await readReadiness(policyId)).establishmentHistory.recovery).toMatchObject({
      stateId: 'rollback_manifest_invalid', rollbackAvailable: false,
    });
    await expectReversionBlocked(policyId, 701, 'snapshot_manifest_invalid');
  }

  await saveManifest({ policy_id: String(policyId), library_id: String(libraryId) });
  expect((await readReadiness(policyId)).establishmentHistory.recovery.rollbackAvailable).toBe(true);
  expect((await revert(policyId, 701).expect(200)).body.statusId).toBe('applied_to_compatibility');
});

test('does not return another policy’s declared rules or snapshot references', async () => {
  const first = await seed('Initial rollback source scope', lower, 801);
  const second = await seed('Initial rollback other scope', upper, 802);
  await db.query('DELETE FROM policy_initial_intent_establishments WHERE policy_id = $1', [second.policyId]);
  const [, other] = await snapshots();
  await db.query('UPDATE policy_initial_intent_establishments SET intent_id = $2 WHERE policy_id = $1',
    [first.policyId, other.intent_id]);
  const wrongIntent = await readReadiness(first.policyId);
  expect(wrongIntent.establishmentHistory.establishment.intentId).toBeNull();
  expect(wrongIntent.establishmentHistory.recovery.stateId).toBe('rollback_proof_unverified');
  expect(wrongIntent.declaredRuleSummary).toMatchObject({ stateId: 'invalid', declaredIntent: null });
  await db.query('UPDATE policy_initial_intent_establishments SET rollback_snapshot_id = $2 WHERE policy_id = $1',
    [first.policyId, upper]);
  const wrongSnapshot = await readReadiness(first.policyId);
  expect(wrongSnapshot.establishmentHistory.recovery).toEqual({
    stateId: 'rollback_snapshot_missing', snapshotId: null, expiresAt: null, restoredAt: null, rollbackAvailable: false,
  });
});

test('uses each exact establishment receipt including an inactive adjacent intent', async () => {
  const first = await seed('Lower initial rollback', lower, upper);
  const second = await seed('Upper initial rollback', upper, lower);
  expect((await establish(second)).establishment).toMatchObject({ rollbackSnapshotId: upper, replayed: true });
  await db.query('UPDATE policy_intents SET active = FALSE WHERE policy_id = $1', [first.policyId]);
  await db.query(`UPDATE policy_intent_migration_events SET metadata = metadata ||
    '{"actorSourceId":"unverified-source"}'::jsonb WHERE id = $1`, [upper]);

  await setNextId('policy_intent_migration_events', 2000);
  expect(await redact(await snapshots())).toEqual(new Map([[lower, upper], [upper, lower]]));
  expect((await snapshots()).map(auditSource)).toEqual([expectedSource(upper), expectedSource(lower)]);
});

async function addLegacyCandidate({ id, intent_id: intentId, policy_id: policyId }) {
  await db.query(`INSERT INTO policy_intent_migration_events
    (intent_id, policy_id, event_type, actor_type, actor_id, target_version, reason_code, metadata)
    VALUES ($1, $2, 'rollback_snapshot_created', 'operator', 7, 1, 'synthetic_legacy', $3::jsonb)`,
  [intentId, policyId, JSON.stringify({ snapshotId: id })]);
}

test('preserves the original claim through merge and maps verified links through two replace restores', async () => {
  await seed('Initial rollback restore', lower, upper);
  const archive = await exportArchive();
  await restore(archive, 'merge', 1700, 1800);
  const [copy, original] = await snapshots();
  expect(copy).toMatchObject({ id: 1700, migration_event_id: null, intent_id: original.intent_id, policy_id: original.policy_id });
  expect(original).toMatchObject({ id: lower, migration_event_id: upper });
  await setNextId('policy_intent_migration_events', 1900);
  await addLegacyCandidate(copy);
  expect(await redact([copy, original])).toEqual(new Map([[1700, null], [lower, upper]]));
  const historical = (await snapshots()).map(row => row.snapshot_payload);
  await restore(await exportArchive(), 'replace', 2200, 2300);
  const restoredHistory = await snapshots();
  expect(restoredHistory.map(row => row.snapshot_payload)).toEqual(historical);
  await redact(restoredHistory);
  expect((await snapshots()).map(row => row.snapshot_payload)).toEqual(historical);

  await restore(archive, 'replace', 2700, 2800);
  expect(await snapshots()).toMatchObject([{ id: 2700, migration_event_id: 2800 }]);
  await restore(await exportArchive(), 'replace', maximum, upper);
  const raw = await snapshots();
  expect(raw).toMatchObject([{ id: maximum, migration_event_id: upper }]);
  expect(await redact(raw)).toEqual(new Map([[maximum, upper]]));
  expect(auditSource((await snapshots())[0])).toEqual(expectedSource(upper));
});

test('redacts with an empty source when the receipt names a different intent event', async () => {
  const first = await seed('Initial receipt claim', lower, upper);
  const second = await seed('Initial receipt alternate', upper, lower);
  await db.query('DELETE FROM policy_initial_intent_establishments WHERE policy_id = $1', [second.policyId]);
  await db.query('UPDATE policy_initial_intent_establishments SET migration_event_id = $1 WHERE policy_id = $2', [lower, first.policyId]);
  const [claimed, other] = await snapshots();
  await setNextId('policy_intent_migration_events', 2000);
  await addLegacyCandidate(claimed);
  expect(await redact([claimed, other])).toEqual(new Map([[lower, null], [upper, null]]));
  expect((await snapshots()).map(auditSource)).toEqual([expectedSource(null), expectedSource(null)]);
});

test('does not credit rebuild evidence for a snapshot already claimed by an establishment receipt', async () => {
  const receipt = await seed('Contested receipt', 701, 801);
  const [owned] = await snapshots();
  const fingerprint = 'a'.repeat(64);
  await db.query(`UPDATE policy_intent_rollback_snapshots SET restore_path = 'synthetic/contested',
    snapshot_payload = snapshot_payload || $2::jsonb WHERE id = $1`, [owned.id, JSON.stringify({
    acceptance: {
      transition_fingerprint: fingerprint, proposal_fingerprint: fingerprint,
      rollback_plan_fingerprint: fingerprint, actor_reference: fingerprint, actor_source_id: 'manual_operator',
    },
  })]);
  await db.query(`INSERT INTO policy_intent_migration_events
    (intent_id, policy_id, event_type, actor_type, source_version, target_version, reason_code, metadata)
    VALUES ($1, $2, 'rollback_snapshot_created', 'operator', 1, 1, 'library_rebuild_snapshot_persisted', $3::jsonb)`,
  [owned.intent_id, receipt.policyId, JSON.stringify({
    snapshotId: owned.id, transitionFingerprint: fingerprint, proposalFingerprint: fingerprint,
    rollbackPlanFingerprint: fingerprint, actorReference: fingerprint, actorSourceId: 'manual_operator',
    idempotencyKey: `policy:library_rebuild_acceptance:${fingerprint}`,
  })]);
  expect(await redact(await snapshots())).toEqual(new Map([[owned.id, null]]));
  expect(auditSource((await snapshots())[0])).toEqual(expectedSource(null));
});

test.each([
  ['duplicate snapshot ID', data => data.policyIntentRollbackSnapshots.push({ ...data.policyIntentRollbackSnapshots[0], id: '701' })],
  ['duplicate event ID', data => data.policyIntentMigrationEvents.push({ ...data.policyIntentMigrationEvents[0], id: '801' })],
  ['duplicate receipt claim', data => data.policyInitialIntentEstablishments.push({ ...data.policyInitialIntentEstablishments[0], id: 903 })],
  ['conflicting event owner', data => { data.policyIntentMigrationEvents[0].intent_id += 1000; }],
  ['conflicting snapshot owner', data => { data.policyIntentRollbackSnapshots[0].policy_id += 1000; }],
  ['conflicting receipt library', data => { data.policyInitialIntentEstablishments[0].library_id += 1000; }],
  ['conflicting library identities', data => data.libraries.push({ ...data.libraries.find(row =>
    row.id === data.policyInitialIntentEstablishments[0].library_id), id: 3001 })],
  ['competing policies for the same library', data => data.libraryPolicies.push({ ...data.libraryPolicies.find(row =>
    row.id === data.policyInitialIntentEstablishments[0].policy_id), id: 3002 })],
])('refuses a %s before writing either restore mode', async (_name, edit) => {
  await seed('Protected initial receipt', 701, 801);
  const archive = await exportArchive();
  const before = await snapshots();
  edit(archive.data);
  for (const mode of ['merge', 'replace']) {
    const statements = [];
    await expect(db.withTransaction(client => restoreAllTables({
      query: (sql, params) => {
        statements.push(sql);
        return client.query(sql, params);
      },
    }, archive, mode))).rejects.toThrow(/^Invalid initial intent establishment backup reference/);
    expect(statements).toEqual([]);
    expect(await snapshots()).toEqual(before);
  }
});

test('refuses a shared idempotency key on distinct completed archive receipts', async () => {
  await seed('First archived claim', 701, 801);
  await seed('Second archived claim', 702, 802);
  const archive = await exportArchive();
  const [first, second] = archive.data.policyInitialIntentEstablishments;
  second.idempotency_key = first.idempotency_key;
  await expect(db.withTransaction(client => restoreAllTables(client, archive, 'replace')))
    .rejects.toThrow(/policyInitialIntentEstablishments\[1\]\.idempotency_key/);
  expect(await snapshots()).toMatchObject([{ id: 701, migration_event_id: 801 }, { id: 702, migration_event_id: 802 }]);
});
