/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */

import { afterEach, expect, jest, test } from '@jest/globals';
import { createPolicyEngineIntegrationFixture } from '../setup/createPolicyEngineIntegrationFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { clearExistingConfig, restoreAllTables } = await import('../../services/backupRestore.mjs');
const { collectBackupSnapshot } = await import('../../services/backupSnapshot.mjs');
const { NativeIntentReconciliationExecutionService } = await import('../../services/nativeIntentReconciliationExecutionService.mjs');
const { applyPolicyPostUpgradeApplyGate, runPolicyPostUpgradeApplyGate } = await import('../../services/policyPostUpgradeApplyGate.mjs');
const { buildPolicyPostUpgradeDryRun, loadPolicyPostUpgradeCandidateInputs } = await import('../../services/policyPostUpgradeDryRun.mjs');
const { PolicyRollbackSnapshotRetentionService } = await import('../../services/policyRollbackSnapshotRetentionService.mjs');

const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';
const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const cleanup = new PolicyRollbackSnapshotRetentionService({ db, logger, lockKey: 2007 });

afterEach(() => db.withTransaction(clearExistingConfig));

function setSequence(table, id) {
  return db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
}

function seedPolicy(name) {
  return createPolicyEngineIntegrationFixture(db, {
    libraryName: name, policyName: name, presetSignals: { genres: { require_any: ['Family'] } },
  });
}

async function readCaptures() {
  const { rows } = await db.query(`SELECT id, policy_id, intent_id, actor_type, target_version, metadata
    FROM policy_intent_migration_events WHERE event_type = 'rollback_snapshot_created' ORDER BY id`);
  return rows;
}

async function readSnapshots() {
  const { rows } = await db.query(`SELECT id, policy_id, intent_id, snapshot_version,
    payload_redacted, snapshot_payload, restore_path, expires_at
    FROM policy_intent_rollback_snapshots ORDER BY id`);
  return rows;
}

async function readFreshAttribution(snapshots) {
  const now = new Date(Math.max(...snapshots.map(row => row.expires_at.getTime())));
  expect(await cleanup.cleanup({ now })).toMatchObject({
    statusId: 'completed', redactedSnapshotCount: snapshots.filter(row => !row.payload_redacted).length,
  });
  const { rows } = await db.query(`SELECT metadata -> 'snapshotId' AS snapshot_id,
    metadata -> 'sourceAuditEventId' AS source_id
    FROM policy_intent_migration_events WHERE event_type = 'rollback_snapshot_payload_redacted'
    ORDER BY id`);
  return new Map(rows.map(row => [row.snapshot_id, row.source_id]));
}

async function exportArchive() {
  return JSON.parse(JSON.stringify(await collectBackupSnapshot({ includePatterns: false })));
}

async function restore(archive, mode, firstSnapshotId, firstEventId) {
  await setSequence('policy_intent_rollback_snapshots', firstSnapshotId);
  await setSequence('policy_intent_migration_events', firstEventId);
  return db.withTransaction(client => restoreAllTables(client, archive, mode));
}

test('links adjacent large captures from post-upgrade apply and reconciliation and preserves replay', async () => {
  const now = new Date();
  await setSequence('policy_intent_rollback_snapshots', lower);
  const postUpgrade = await seedPolicy('Exact conversion rollback');
  const inputs = await loadPolicyPostUpgradeCandidateInputs({ dbClient: db, maxPolicies: 1, unconvertedOnly: true });
  const dryRun = buildPolicyPostUpgradeDryRun({ ...inputs, now });
  const applyArgs = { dbClient: db, dryRun, policies: inputs.policies, now };
  expect(await applyPolicyPostUpgradeApplyGate(applyArgs)).toMatchObject({ applied: true, appliedPolicyCount: 1 });
  const reconciled = await seedPolicy('Exact reconciliation rollback');
  const execution = new NativeIntentReconciliationExecutionService({ dbClient: db, loggerInstance: logger });
  expect(await execution.run({ maxPolicies: 1, now })).toMatchObject({ applied: true, appliedPolicyCount: 1 });
  expect(await applyPolicyPostUpgradeApplyGate(applyArgs)).toMatchObject({
    applied: true, appliedPolicyCount: 0, alreadyConvertedCount: 1,
  });
  const captures = await readCaptures();
  const snapshots = await readSnapshots();
  expect(snapshots.map(row => row.id)).toEqual([lower, upper]);
  expect(captures).toMatchObject([
    { policy_id: postUpgrade.policyId, actor_type: 'post_upgrade', metadata: { snapshotId: lower, actorSourceId: 'post_upgrade_apply' } },
    { policy_id: reconciled.policyId, actor_type: 'reconciler', metadata: { snapshotId: upper, actorSourceId: 'native_intent_reconciliation' } },
  ]);
  for (const [index, snapshot] of snapshots.entries()) {
    expect(captures[index]).toMatchObject({
      intent_id: snapshot.intent_id, target_version: snapshot.snapshot_version,
      metadata: { restorePath: snapshot.restore_path },
    });
  }
  expect(await readFreshAttribution(snapshots)).toEqual(new Map([[lower, captures[0].id], [upper, captures[1].id]]));
});

test('keeps the native and imported owners distinct across merge and successive replace restores', async () => {
  await seedPolicy('Conversion rollback round trip');
  await setSequence('policy_intent_rollback_snapshots', 701);
  expect(await runPolicyPostUpgradeApplyGate({
    dbClient: db, maxPolicies: 1, action: { reasonCode: 'library_rebuild_snapshot_persisted' },
  })).toMatchObject({ appliedPolicyCount: 1 });
  const [original] = await readCaptures();
  expect(original.metadata.snapshotId).toBe(701);
  const source = await exportArchive();

  await restore(source, 'merge', 1700, 2600);
  const [saved, imported] = await readCaptures();
  expect(saved).toEqual(original);
  expect(imported).toMatchObject({
    policy_id: original.policy_id, intent_id: original.intent_id,
    metadata: { ...original.metadata, retentionSnapshotId: 1700 },
  });
  expect(await readFreshAttribution(await readSnapshots())).toEqual(new Map([[701, original.id], [1700, imported.id]]));
  const historical = (await readSnapshots()).map(row => row.snapshot_payload);
  const redactedArchive = await exportArchive();
  await restore(redactedArchive, 'replace', 2700, 3100);
  expect((await readSnapshots()).map(row => row.snapshot_payload)).toEqual(historical);
  expect(await cleanup.cleanup({ now: new Date('2027-04-01T00:00:00Z') })).toMatchObject({ redactedSnapshotCount: 0 });

  await restore(source, 'replace', 3600, 4600);
  const [firstRestore] = await readCaptures();
  expect(firstRestore.metadata).toEqual({ ...original.metadata, retentionSnapshotId: 3600 });
  await restore(await exportArchive(), 'replace', maximum, upper);
  const [secondRestore] = await readCaptures();
  expect(secondRestore.metadata).toEqual({ ...original.metadata, retentionSnapshotId: maximum });
  expect(await readFreshAttribution(await readSnapshots())).toEqual(new Map([[maximum, secondRestore.id]]));
});

test.each([
  'path-only history', 'wrong restore path', 'wrong actor source', 'wrong actor type',
  'nonpositive actor', 'duplicate verified event',
])(
  'records an unavailable source for %s',
  async (caseName) => {
    await seedPolicy('Conversion attribution gap');
    await setSequence('policy_intent_rollback_snapshots', 701);
    expect(await runPolicyPostUpgradeApplyGate({ dbClient: db, maxPolicies: 1 })).toMatchObject({ appliedPolicyCount: 1 });
    const archive = await exportArchive();
    const event = archive.data.policyIntentMigrationEvents.find(row => row.event_type === 'rollback_snapshot_created');
    if (caseName === 'path-only history') delete event.metadata.snapshotId;
    if (caseName === 'wrong restore path') event.metadata.restorePath = 'synthetic/wrong-restore-path';
    if (caseName === 'wrong actor source') event.metadata.actorSourceId = 'native_intent_reconciliation';
    if (caseName === 'wrong actor type') event.actor_type = 'operator';
    if (caseName === 'nonpositive actor') event.actor_id = 0;
    if (caseName === 'duplicate verified event') archive.data.policyIntentMigrationEvents.push({ ...event, id: upper });
    // Reuse the source ID to prove an explicit null cannot match by numeric coincidence.
    await restore(archive, 'replace', 701, 2600);
    const captures = await readCaptures();
    if (caseName === 'path-only history') {
      expect(captures[0].metadata).toEqual(event.metadata);
    } else if (caseName === 'duplicate verified event') {
      expect(captures).toHaveLength(2);
      for (const capture of captures) expect(capture.metadata.retentionSnapshotId).toBe(701);
    } else {
      expect(captures[0].metadata.retentionSnapshotId).toBeNull();
    }
    expect(await readFreshAttribution(await readSnapshots())).toEqual(new Map([[701, null]]));
  },
);

test.each([
  ['snapshot row absent', (sql, rows) => sql.includes('INSERT INTO policy_intent_rollback_snapshots') ? [] : rows],
  ['capture reference mismatched', (sql, rows) => sql.includes('AS snapshot_id_text')
    ? [{ ...rows[0], snapshot_id_text: lower }] : rows],
  ['capture JSON type mismatched', (sql, rows) => sql.includes('AS snapshot_id_text')
    ? [{ ...rows[0], snapshot_id_type: 'number' }] : rows],
])('rolls back the pending conversion when the %s', async (_caseName, change) => {
  await seedPolicy('Conversion acknowledgement rollback');
  await setSequence('policy_intent_rollback_snapshots', upper);
  const dbClient = {
    query: (...args) => db.query(...args),
    withTransaction: work => db.withTransaction(client => work({
      query: async (sql, params) => {
        const result = await client.query(sql, params);
        return { ...result, rows: change(sql, result.rows) };
      },
    })),
  };
  expect(await runPolicyPostUpgradeApplyGate({ dbClient, maxPolicies: 1 })).toMatchObject({
    applied: false, appliedPolicyCount: 0, statusId: 'failed_rolled_back', failureCategory: 'apply_failed_rolled_back',
  });
  expect(await readSnapshots()).toEqual([]);
  expect((await db.query('SELECT id FROM policy_intent_migration_events')).rows).toEqual([]);
  expect((await db.query('SELECT id FROM policy_intents')).rows).toEqual([]);
});

test('rolls back when a database trigger suppresses the creation event', async () => {
  await seedPolicy('Conversion suppressed capture');
  await setSequence('policy_intent_rollback_snapshots', upper);
  await db.query(`CREATE FUNCTION suppress_conversion_rollback_capture() RETURNS trigger
    LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'rollback_snapshot_created' THEN RETURN NULL; END IF;
        RETURN NEW;
      END;
    $$`);
  await db.query(`CREATE TRIGGER suppress_conversion_rollback_capture
    BEFORE INSERT ON policy_intent_migration_events FOR EACH ROW
    EXECUTE FUNCTION suppress_conversion_rollback_capture()`);
  try {
    expect(await runPolicyPostUpgradeApplyGate({ dbClient: db, maxPolicies: 1 })).toMatchObject({
      applied: false, appliedPolicyCount: 0, statusId: 'failed_rolled_back',
    });
    expect(await readSnapshots()).toEqual([]);
    expect((await db.query('SELECT id FROM policy_intent_migration_events')).rows).toEqual([]);
    expect((await db.query('SELECT id FROM policy_intents')).rows).toEqual([]);
  } finally {
    await db.query('DROP TRIGGER suppress_conversion_rollback_capture ON policy_intent_migration_events');
    await db.query('DROP FUNCTION suppress_conversion_rollback_capture()');
  }
});
