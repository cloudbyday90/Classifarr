/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { createLibraryRebuildIdentityFixture } = await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot } = await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { applyPolicyLibraryRebuildReplacement } = await import('../../services/policyLibraryRebuildReplacementGate.mjs');
const { loadPolicyPurposeEvidenceInventoryRecord } = await import('../../services/policyPurposeEvidenceInventoryPersistence.mjs');
const { loadPolicyPurposeLifecycleProvenanceReceiptRecords } = await import('../../services/policyPurposeLifecycleProvenanceReceiptPersistence.mjs');
const { loadHeldOutSemanticStudyLifecycleReauditSourceRecord } = await import('../../services/heldOutSemanticStudyLifecycleReauditSource.mjs');

const { fixture, setNextMigrationEventId, closeRollbackWindow } = createLibraryRebuildIdentityFixture(db);
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';

function setId(table, id) {
  return db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
}

async function rebuild(slot, references = {}) {
  const base = 2000 + slot * 10;
  const {
    original = base, replacement = base + 1, run = base, gate = base, snapshot = base,
    captureEventId = base, replacementEventId = base + 1,
  } = references;
  await setId('policy_intents', original);
  await setId('policy_migration_verification_runs', run);
  const item = await fixture(`purpose-proof-${slot}`, snapshot, gate, { captureEventId });
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'rollback_snapshot_persisted',
    execution: { intentId: original, verificationRunId: run, migrationEventId: captureEventId },
  });
  await setId('policy_intents', replacement);
  await setNextMigrationEventId(replacementEventId);
  const applied = await applyPolicyLibraryRebuildReplacement(item.args);
  expect(applied).toMatchObject({
    statusId: 'replacement_applied',
    execution: { gateId: gate, replacementIntentId: replacement, replacementEventId },
  });
  return { ...item, replacement, replacementEventId };
}

function replaceMetadata(eventId, metadata) {
  return db.query('UPDATE policy_intent_migration_events SET metadata = $2::jsonb WHERE id = $1', [
    eventId, JSON.stringify(metadata),
  ]);
}

function setReference(eventId, key, json) {
  return db.query(`UPDATE policy_intent_migration_events
    SET metadata = jsonb_set(metadata, ARRAY[$2::text], $3::jsonb) WHERE id = $1`, [eventId, key, json]);
}

function readReports() {
  return db.withTransaction(async client => {
    await client.query('SET TRANSACTION READ ONLY');
    const inventory = await loadPolicyPurposeEvidenceInventoryRecord({ db: client });
    const recent = await loadPolicyPurposeLifecycleProvenanceReceiptRecords({ db: client, limit: 1 });
    const heldOut = await loadHeldOutSemanticStudyLifecycleReauditSourceRecord({ db: client });
    return { current: inventory.current_intent_lifecycle_receipt_policy_count, recent, heldOut };
  });
}

test('verifies large rebuild references before they contribute to any lifecycle report', async () => {
  const legacy = await rebuild(1, { captureEventId: lower, replacementEventId: upper });
  await replaceMetadata(legacy.captureEventId, {});
  await replaceMetadata(legacy.replacementEventId, {});
  await db.query(`UPDATE policy_intent_rules SET source = 'operator_declared_intent'
    WHERE intent_id = $1 AND intent_role = 'purpose'`, [legacy.replacement]);
  const baseline = await readReports();
  expect(baseline.current).toBe(1);
  expect(baseline.heldOut.library_rebuild_replacement_count).toBe(1);
  expect(baseline.recent).toHaveLength(1);
  expect(baseline.recent[0].declared_native_purpose_rule_count).toBeGreaterThan(0);

  const gateOnly = await rebuild(2, { gate: maximum });
  const snapshotOnly = await rebuild(3, { snapshot: upper });
  const runOnly = await rebuild(4, { run: maximum });
  const originalOnly = await rebuild(5, { original: lower });
  const replacementOnly = await rebuild(6, { replacement: upper });
  const allLarge = await rebuild(7, { original: '9007199254740994', replacement: maximum,
    run: upper, gate: upper, snapshot: maximum, captureEventId: '9007199254740994', replacementEventId: maximum });
  await closeRollbackWindow(allLarge);
  await setReference(gateOnly.replacementEventId, 'rollbackSnapshotId', JSON.stringify(String(gateOnly.snapshotId)));
  const complete = await readReports();
  expect(complete.current).toBe(7);
  expect(complete.heldOut.library_rebuild_replacement_count).toBe(7);
  expect(complete.recent).toHaveLength(1);
  expect(complete.recent[0].declared_native_purpose_rule_count).toBe(0);

  // Alter the evidence while leaving the joined rows and their foreign keys intact.
  await setReference(gateOnly.replacementEventId, 'executionGateId', maximum);
  await setReference(snapshotOnly.replacementEventId, 'rollbackSnapshotId', JSON.stringify(lower));
  await setReference(runOnly.captureEventId, 'verificationRunId', maximum);
  await db.query(`UPDATE policy_intent_migration_events SET metadata = metadata - 'originalIntentId'
    WHERE id = $1`, [originalOnly.captureEventId]);
  await setReference(replacementOnly.replacementEventId, 'replacementIntentId', upper);
  await db.query(`UPDATE policy_intent_migration_events SET metadata = metadata - 'verificationRunFingerprint'
    WHERE id = $1`, [allLarge.replacementEventId]);

  const filtered = await readReports();
  expect(filtered).toEqual(baseline);
  expect(await applyPolicyLibraryRebuildReplacement(runOnly.args)).toMatchObject({
    statusId: 'already_applied',
  });
  const { rows: [{ count }] } = await db.query(`SELECT COUNT(*)::int AS count
    FROM policy_library_rebuild_execution_gates WHERE state = 'replacement_applied'`);
  expect(count).toBe(7);

  // Historic reporting can still use sound evidence after another intent is active.
  await setReference(allLarge.replacementEventId, 'verificationRunFingerprint', JSON.stringify('c'.repeat(64)));
  await db.withTransaction(async client => {
    await client.query('UPDATE policy_intents SET active = FALSE WHERE id = $1', [allLarge.replacement]);
    await client.query('UPDATE policy_intents SET active = TRUE WHERE id = $1', [allLarge.intentId]);
  });
  const historical = await readReports();
  expect(historical.current).toBe(1);
  expect(historical.heldOut.library_rebuild_replacement_count).toBe(2);
  expect(historical.recent).toHaveLength(1);
  expect(historical.recent[0].declared_native_purpose_rule_count).toBe(0);
});
