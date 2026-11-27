/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { persistPolicyLibraryRebuildRollbackSnapshot, validatePolicyLibraryRebuildSnapshotGate } =
  await import('../../services/policyLibraryRebuildSnapshotGate.mjs');
const { createLibraryRebuildIdentityFixture } = await import('../setup/createLibraryRebuildIdentityFixture.mjs');
const { fixture } = createLibraryRebuildIdentityFixture(db);

test.each([
  ['safe', 913, 813, 7012],
  ['lower', 914, 814, '9007199254740992'],
  ['upper', 915, 815, '9007199254740993'],
  ['maximum', 916, 816, '9223372036854775807'],
])('preserves the %s capture event identity from storage through replay', async (tag, snapshotId, gateId, eventId) => {
  const item = await fixture(`capture-event-${tag}`, snapshotId, gateId, eventId);
  const captured = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  const replay = await persistPolicyLibraryRebuildRollbackSnapshot(item.args);
  expect(captured).toMatchObject({
    statusId: 'rollback_snapshot_persisted', execution: { migrationEventId: eventId }, validation: { ok: true },
  });
  expect(replay).toMatchObject({
    statusId: 'already_persisted', execution: { migrationEventId: eventId }, validation: { ok: true },
  });
  const { rows } = await db.query(`SELECT gate.id, gate.rollback_snapshot_id, gate.migration_event_id,
    event.id AS joined_event_id, event.event_type
    FROM policy_library_rebuild_execution_gates gate
    JOIN policy_intent_migration_events event ON event.id = gate.migration_event_id
    WHERE gate.policy_id = $1`, [item.policyId]);
  expect(rows).toEqual([{
    id: gateId, rollback_snapshot_id: snapshotId, migration_event_id: eventId,
    joined_event_id: eventId, event_type: 'rollback_snapshot_created',
  }]);
  if (typeof eventId === 'string') {
    expect(validatePolicyLibraryRebuildSnapshotGate({
      ...replay, execution: { ...replay.execution, migrationEventId: Number(eventId) },
    }).ok).toBe(false);
  }
});

test('rolls back capture when completion saved another event from the same policy', async () => {
  const existingEventId = '9007199254741032';
  const insertedEventId = '9007199254741033';
  const item = await fixture('capture-event-link', 917, 817, insertedEventId);
  await db.query(`INSERT INTO policy_intent_migration_events
    (id, intent_id, policy_id, event_type, actor_type, source_version, target_version, reason_code)
    VALUES ($1, $2, $3, 'rollback_snapshot_created', 'operator', 1, 1, 'synthetic_fixture')`,
  [existingEventId, item.intentId, item.policyId]);
  const dbClient = { withTransaction: work => db.withTransaction(client => work({
    query: (sql, params) => {
      if (!sql.includes('UPDATE policy_library_rebuild_execution_gates') ||
          !sql.includes('migration_event_id = $4') || !sql.includes('RETURNING id')) return client.query(sql, params);
      const changed = [...params];
      changed[3] = existingEventId;
      return client.query(sql, changed);
    },
  })) };
  const result = await persistPolicyLibraryRebuildRollbackSnapshot({ ...item.args, dbClient });
  expect(result).toMatchObject({ statusId: 'failed_rolled_back', validation: { ok: false } });
  const { rows } = await db.query(`SELECT
    (SELECT COUNT(*)::int FROM policy_library_rebuild_execution_gates WHERE policy_id = $1) AS gates,
    (SELECT COUNT(*)::int FROM policy_intent_rollback_snapshots WHERE policy_id = $1) AS snapshots,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1 AND id = $2) AS prior_events,
    (SELECT COUNT(*)::int FROM policy_intent_migration_events WHERE policy_id = $1 AND id = $3) AS new_events`,
  [item.policyId, existingEventId, insertedEventId]);
  expect(rows).toEqual([{ gates: 0, snapshots: 0, prior_events: 1, new_events: 0 }]);
});
