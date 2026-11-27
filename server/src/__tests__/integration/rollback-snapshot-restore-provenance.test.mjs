/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { createLibraryRebuildIdentityFixture } from '../setup/createLibraryRebuildIdentityFixture.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { collectBackupSnapshot } = await import('../../services/backupSnapshot.mjs');
const { clearExistingConfig, restoreAllTables } = await import('../../services/backupRestore.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot } = await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { PolicyRollbackSnapshotRetentionService } = await import('../../services/policyRollbackSnapshotRetentionService.mjs');

const sourceId = '9007199254740993';
const sourceEventId = '9007199254740995';
const largeEventId = '9007199254741001';
const maximum = '9223372036854775807';
const { fixture } = createLibraryRebuildIdentityFixture(db);

afterEach(() => db.withTransaction(clearExistingConfig));

function snapshot(id) {
  return db.query('SELECT * FROM policy_intent_rollback_snapshots WHERE id = $1', [id])
    .then(({ rows }) => rows[0]);
}

function migrationEvent(id) {
  return db.query('SELECT * FROM policy_intent_migration_events WHERE id = $1', [id])
    .then(({ rows }) => rows[0]);
}

async function retentionEvent(id) {
  const { rows } = await db.query(`SELECT * FROM policy_intent_migration_events
    WHERE event_type = 'rollback_snapshot_payload_redacted' AND metadata ->> 'snapshotId' = $1::text`, [id]);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function capture(tag) {
  const item = await fixture(tag, sourceId, 123, { captureEventId: sourceEventId });
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'rollback_snapshot_persisted', execution: { migrationEventId: sourceEventId },
  });
  return item;
}

async function exportArchive() {
  const archive = await collectBackupSnapshot({ includePatterns: false });
  return JSON.parse(JSON.stringify(archive));
}

async function restore(archive, mode, destinationId, destinationEventId) {
  for (const [table, id] of [
    ['policy_intent_rollback_snapshots', destinationId],
    ['policy_intent_migration_events', destinationEventId],
  ]) {
    await db.query("SELECT setval(pg_get_serial_sequence($1, 'id'), $2::bigint, false)", [table, id]);
  }
  return db.withTransaction(client => restoreAllTables(client, archive, mode));
}

function retention() {
  return new PolicyRollbackSnapshotRetentionService({
    db, lockKey: 2007, logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
  });
}

async function expectRedaction(cleanup, id, eventId, now) {
  expect(await cleanup.cleanup({ now })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [id] });
  const redacted = await snapshot(id);
  const audit = await retentionEvent(id);
  expect(redacted).toMatchObject({
    payload_redacted: true,
    snapshot_payload: { retention_marker: {
      policy_id: redacted.policy_id,
      intent_id: redacted.intent_id,
      source_audit: { migration_event_id: eventId },
    } },
  });
  expect(audit).toMatchObject({
    policy_id: redacted.policy_id,
    intent_id: redacted.intent_id,
    metadata: { snapshotId: id, sourceAuditEventId: eventId, payloadDigest: redacted.snapshot_payload.retention_marker.payload_digest },
  });
  return { redacted, audit };
}

test('rebinds the exact creation event through replace and re-export while keeping historical redaction intact', async () => {
  await capture('rollback-restore-roundtrip');
  const originalCapture = await migrationEvent(sourceEventId);
  const now = (await snapshot(sourceId)).expires_at;
  const cleanup = retention();
  let rawArchive = await exportArchive();
  const historical = await expectRedaction(cleanup, sourceId, sourceEventId, now);
  const historicalArchive = await exportArchive();

  for (const [id, eventId] of [[1900, 1901], [maximum, largeEventId]]) {
    await restore(rawArchive, 'replace', id, eventId);
    const restored = await snapshot(id);
    const event = await migrationEvent(eventId);
    expect(event).toMatchObject({ policy_id: restored.policy_id, intent_id: restored.intent_id });
    expect(event.metadata).toEqual({ ...originalCapture.metadata, retentionSnapshotId: id });
    rawArchive = await exportArchive();
  }
  const destination = await expectRedaction(cleanup, maximum, largeEventId, now);
  expect(destination.redacted.snapshot_payload.retention_marker.payload_digest)
    .toBe(historical.redacted.snapshot_payload.retention_marker.payload_digest);

  await restore(historicalArchive, 'replace', 2900, 2901);
  expect((await snapshot(2900)).snapshot_payload).toEqual(historical.redacted.snapshot_payload);
  expect((await migrationEvent(2902)).metadata).toEqual(historical.audit.metadata);
  expect(await cleanup.cleanup({ now })).toMatchObject({ statusId: 'completed', redactedSnapshotCount: 0 });
});

test('binds an imported copy on merge without changing the existing capture or its replay', async () => {
  await db.query("SELECT setval(pg_get_serial_sequence('policy_migration_verification_runs', 'id'), $1::bigint, false)", [largeEventId]);
  const item = await capture('rollback-restore-merge');
  const originalCapture = await migrationEvent(sourceEventId);
  const originalSnapshot = await snapshot(sourceId);
  expect(originalCapture.metadata.verificationRunId).toBe(largeEventId);
  await restore(await exportArchive(), 'merge', '9007199254740992', largeEventId);
  expect(await migrationEvent(sourceEventId)).toEqual(originalCapture);
  expect(await snapshot(sourceId)).toEqual(originalSnapshot);
  expect((await migrationEvent(largeEventId)).metadata).toEqual({
    ...originalCapture.metadata, retentionSnapshotId: '9007199254740992',
  });
  expect(await persistPolicyLibraryRebuildRollbackSnapshot(item.args)).toMatchObject({
    statusId: 'already_persisted', execution: { migrationEventId: sourceEventId },
  });

  const now = originalSnapshot.expires_at;
  const cleanup = retention();
  expect(await cleanup.cleanup({ now })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: ['9007199254740992', sourceId],
  });
  expect((await retentionEvent('9007199254740992')).metadata.sourceAuditEventId).toBe(largeEventId);
  expect((await retentionEvent(sourceId)).metadata.sourceAuditEventId).toBe(sourceEventId);
});

test.each([
  ['authoritative null', data => { data.policyIntentMigrationEvents[0].metadata.retentionSnapshotId = null; }],
  ['unsafe numeric link', data => { data.policyIntentMigrationEvents[0].metadata.snapshotId = Number(sourceId); }],
  ['unexpected numeric actor', data => { data.policyIntentMigrationEvents[0].actor_id = 7; }],
  ['wrong acceptance field', data => { data.policyIntentMigrationEvents[0].metadata.actorReference = 'a'.repeat(64); }],
  ['duplicate snapshot', data => { data.policyIntentRollbackSnapshots.push(data.policyIntentRollbackSnapshots[0]); }],
])('retains a provenance gap under %s', async (label, change) => {
  await capture(`rollback-gap-${label.replaceAll(' ', '-')}`);
  const now = (await snapshot(sourceId)).expires_at;
  const archive = await exportArchive();
  change(archive.data);
  await restore(archive, 'replace', 1900, 1901);
  const event = await migrationEvent(1901);
  expect(event.metadata.retentionSnapshotId).toBeNull();
  const cleanup = retention();
  await restore(await exportArchive(), 'replace', 2900, 2901);
  expect((await migrationEvent(2901)).metadata.retentionSnapshotId).toBeNull();
  if (label === 'duplicate snapshot') {
    expect(await cleanup.cleanup({ now })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [2900, 2901] });
    expect((await retentionEvent(2900)).metadata.sourceAuditEventId).toBeNull();
    expect((await retentionEvent(2901)).metadata.sourceAuditEventId).toBeNull();
  } else {
    await expectRedaction(cleanup, 2900, null, now);
  }
});

test('rejects competing rebuild creation events during redaction', async () => {
  await capture('rollback-restore-competing');
  const archive = await exportArchive();
  const original = archive.data.policyIntentMigrationEvents[0];
  archive.data.policyIntentMigrationEvents.push({ ...original, id: largeEventId });
  const now = (await snapshot(sourceId)).expires_at;
  await restore(archive, 'replace', 1900, 1901);
  expect((await migrationEvent(1901)).metadata.retentionSnapshotId).toBe(1900);
  expect((await migrationEvent(1902)).metadata.retentionSnapshotId).toBe(1900);
  await expectRedaction(retention(), 1900, null, now);
});

test('keeps raw metadata precision and checks the archived reference before binding', async () => {
  await capture('rollback-restore-raw');
  const now = (await snapshot(sourceId)).expires_at;
  const archive = await exportArchive();
  const event = archive.data.policyIntentMigrationEvents[0];
  const { originalIntentId: _originalIntentId, ...metadata } = event.metadata;
  const rawMetadata = JSON.stringify(metadata).slice(0, -1) + ',"originalIntentId":9007199254740993';

  event.metadata = rawMetadata + '}';
  await restore(archive, 'replace', 1900, 1901);
  const readReference = () => db.query(`SELECT metadata ->> 'originalIntentId' AS original_intent_id,
      jsonb_typeof(metadata -> 'originalIntentId') AS original_intent_type,
      metadata -> 'retentionSnapshotId' AS retention_snapshot_id
    FROM policy_intent_migration_events WHERE id = 1901`).then(({ rows }) => rows[0]);
  expect(await readReference()).toEqual({
    original_intent_id: sourceId, original_intent_type: 'number', retention_snapshot_id: 1900,
  });

  archive.data.policyIntentRollbackSnapshots[0].id = 17;
  event.metadata = rawMetadata + ',"retentionSnapshotId":17.00000000000000001}';
  await restore(archive, 'replace', 1900, 1901);
  expect(await readReference()).toEqual({
    original_intent_id: sourceId, original_intent_type: 'number', retention_snapshot_id: null,
  });
  await expectRedaction(retention(), 1900, null, now);
});

test('requires rebuild evidence even when an unannotated capture has the current snapshot ID', async () => {
  await capture('rollback-restore-mismatched-native');
  const now = (await snapshot(sourceId)).expires_at;
  await db.query(`UPDATE policy_intent_migration_events
    SET metadata = metadata || jsonb_build_object('transitionFingerprint', $2::text)
    WHERE id = $1`, [sourceEventId, 'a'.repeat(64)]);
  expect((await migrationEvent(sourceEventId)).metadata).not.toHaveProperty('retentionSnapshotId');
  await expectRedaction(retention(), sourceId, null, now);
});

test('rolls back the imported snapshot if PostgreSQL refuses the creation event', async () => {
  await capture('rollback-restore-transaction');
  const originalSnapshot = await snapshot(sourceId);
  const originalEvent = await migrationEvent(sourceEventId);
  const archive = await exportArchive();
  archive.data.policyIntentMigrationEvents[0].actor_type = 'invalid_archive_actor';

  await expect(restore(archive, 'replace', 1900, 1901)).rejects.toMatchObject({
    code: '23514', constraint: 'policy_intent_migration_events_actor_type_chk',
  });
  expect(await snapshot(1900)).toBeUndefined();
  expect(await migrationEvent(1901)).toBeUndefined();
  expect(await snapshot(sourceId)).toEqual(originalSnapshot);
  expect(await migrationEvent(sourceEventId)).toEqual(originalEvent);
});
