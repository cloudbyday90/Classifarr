/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { createPolicyEngineIntegrationFixture } = await import('../setup/createPolicyEngineIntegrationFixture.mjs');
const { PolicyRollbackSnapshotRetentionService } = await import('../../services/policyRollbackSnapshotRetentionService.mjs');
const { SchedulerRetentionService } = await import('../../services/schedulerRetentionService.mjs');

const now = '2026-11-24T12:00:00.000Z';
const expiresLater = '2026-11-25T12:00:00.000Z';
const lower = '9007199254740992';
const upper = '9007199254740993';
const maximum = '9223372036854775807';
const lockKey = 2007;
const originalPayload = { settings: { synthetic: 'retention-private-sentinel' } };
const missingAudit = {
  migration_event_id: null,
  actor_type: null,
  actor_id: null,
  actor_source_id: null,
  reason_code: null,
};

function makeService(transactionDb = db) {
  return new PolicyRollbackSnapshotRetentionService({
    db: transactionDb, lockKey, logger: { info: jest.fn(), debug: jest.fn(), error: jest.fn() },
  });
}

async function createIntent(tag, intentId) {
  const { policyId, libraryId } = await createPolicyEngineIntegrationFixture(db, {
    libraryName: `Retention ${tag}`, policyName: `Retention ${tag}`,
  });
  await db.query(`WITH header AS (
    INSERT INTO policy_intents (id, policy_id, library_id, source, inference_state, validation_status)
    VALUES ($1, $2, $3, 'native_intent', 'inferred', 'valid') RETURNING id
  )
  INSERT INTO policy_intent_rules (intent_id, collection, intent_role, signal_type, operator,
    values, constraint_mode, semantics, source, inference_state)
  SELECT id, 'purpose', 'purpose', 'genres', 'require_any', '{"require_any":["Animation"]}'::jsonb,
    'advisory', 'identity', 'native_intent', 'inferred' FROM header`, [intentId, policyId, libraryId]);
  return { policyId, intentId };
}

function createSnapshot({ policyId, intentId }, snapshotId, expiresAt = now) {
  return db.query(`INSERT INTO policy_intent_rollback_snapshots
    (id, policy_id, intent_id, snapshot_version, snapshot_payload, payload_redacted, restore_path, created_at, expires_at)
    VALUES ($1, $2, $3, 1, $4::jsonb, false, 'synthetic/restore', '2026-11-20T12:00:00Z', $5)`,
  [snapshotId, policyId, intentId, JSON.stringify(originalPayload), expiresAt]);
}

function createCaptureEvent({ policyId, intentId }, eventId, reason, metadata, version = 1) {
  return db.query(`INSERT INTO policy_intent_migration_events
    (id, policy_id, intent_id, event_type, actor_type, actor_id, source_version, target_version, reason_code, metadata)
    VALUES ($1, $2, $3, 'rollback_snapshot_created', 'operator', 7, $4, $4, $5, $6::jsonb)`,
  [eventId, policyId, intentId, version, reason, JSON.stringify(metadata)]);
}

async function getStoredRows(policyId) {
  const { rows } = await db.query(`SELECT snapshot.id, snapshot.intent_id, snapshot.payload_redacted,
      snapshot.snapshot_payload, event.id AS event_id, event.intent_id AS event_intent_id, event.metadata AS event_metadata
    FROM policy_intent_rollback_snapshots snapshot
    LEFT JOIN policy_intent_migration_events event
      ON event.policy_id = snapshot.policy_id AND event.event_type = 'rollback_snapshot_payload_redacted'
      AND event.metadata ->> 'snapshotId' = snapshot.id::text
    WHERE snapshot.policy_id = $1 ORDER BY snapshot.id`, [policyId]);
  return rows;
}

test('redacts exact snapshot IDs and only persists proven source attribution', async () => {
  const intent = await createIntent('proof', upper);
  const fixtures = [
    { snapshotId: 801, sourceId: 701, reason: 'safe_number', metadata: { snapshotId: 801 } },
    { snapshotId: 802, sourceId: 702, reason: 'safe_string', metadata: { snapshotId: '802' } },
    { snapshotId: 803 },
    { snapshotId: lower },
    { snapshotId: upper, sourceId: upper, reason: 'exact_large', metadata: { snapshotId: upper } },
    { snapshotId: maximum, sourceId: maximum, reason: 'exact_maximum', metadata: { snapshotId: maximum } },
  ];
  for (const { snapshotId, sourceId, reason, metadata } of fixtures) {
    await createSnapshot(intent, snapshotId);
    if (sourceId) await createCaptureEvent(intent, sourceId, reason, { ...metadata, actorSourceId: 'manual_operator' });
  }
  await createCaptureEvent(intent, 703, 'legacy_unbound', { restorePath: 'synthetic/restore' });
  await createCaptureEvent(intent, 704, 'malformed_reference', { snapshotId: [803] });
  await createCaptureEvent(intent, 705, 'wrong_version', { snapshotId: 803 }, 2);
  await createCaptureEvent(intent, 706, 'unsafe_numeric_reference', { snapshotId: Number(lower) });
  await createSnapshot(intent, 804, expiresLater);
  await createSnapshot(intent, 806);
  const historical = { retention_marker: { version: 1, intent_id: Number(lower), source_audit: { migration_event_id: Number(lower) } } };
  await db.query(`UPDATE policy_intent_rollback_snapshots SET snapshot_payload = $1::jsonb, payload_redacted = true
    WHERE id = 806`, [JSON.stringify(historical)]);
  const noSource = await createIntent('without source', 741);
  await createSnapshot(noSource, 805);

  const service = makeService();
  const scheduler = new SchedulerRetentionService({
    policyRollbackSnapshotRetentionService: { cleanup: () => service.cleanup({ now, batchSize: 7 }) },
  });
  expect(await scheduler.runPolicyRollbackSnapshotRetentionCleanup()).toMatchObject({
    statusId: 'completed', redactedSnapshotCount: 7, redactedSnapshotIds: [801, 802, 803, 805, lower, upper, maximum],
    hasMore: true, rawPayloadExposed: false,
  });

  const stored = await getStoredRows(intent.policyId);
  for (const { snapshotId, sourceId = null, reason = null } of fixtures) {
    const selected = stored.find(row => row.id === snapshotId);
    const sourceAudit = sourceId === null ? missingAudit : {
      migration_event_id: sourceId, actor_type: 'operator', actor_id: 7, actor_source_id: 'manual_operator', reason_code: reason,
    };
    expect(selected).toMatchObject({
      intent_id: upper, event_intent_id: upper, payload_redacted: true,
      snapshot_payload: { retention_marker: {
        version: 1, intent_id: upper, source_audit: sourceAudit,
        payload_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      } },
      event_metadata: { snapshotId, sourceAuditEventId: sourceId, markerVersion: 1 },
    });
    expect(JSON.stringify(selected)).not.toContain('retention-private-sentinel');
    expect(selected.event_metadata.payloadDigest).toBe(selected.snapshot_payload.retention_marker.payload_digest);
  }
  expect(stored.find(row => row.id === 804)).toMatchObject({
    payload_redacted: false, snapshot_payload: originalPayload, event_id: null,
  });
  expect(stored.find(row => row.id === 806)).toMatchObject({
    payload_redacted: true, snapshot_payload: historical, event_id: null,
  });
  expect((await db.query('SELECT id, active FROM policy_intents WHERE id = $1', [upper])).rows)
    .toEqual([{ id: upper, active: true }]);
  expect(await getStoredRows(noSource.policyId)).toEqual([expect.objectContaining({
    id: 805, payload_redacted: true, event_metadata: expect.objectContaining({ sourceAuditEventId: null }),
    snapshot_payload: { retention_marker: expect.objectContaining({ intent_id: 741, source_audit: missingAudit }) },
  })]);
  expect(await scheduler.runPolicyRollbackSnapshotRetentionCleanup()).toMatchObject({
    statusId: 'completed', redactedSnapshotCount: 0, hasMore: false,
  });
  expect(await getStoredRows(intent.policyId)).toEqual(stored);
});

test('keeps transactional admission and skips rows locked by another worker', async () => {
  const intent = await createIntent('locks', maximum);
  await createSnapshot(intent, 811);
  await createSnapshot(intent, 812);
  const service = makeService();
  const held = await getPool().connect();
  try {
    await held.query('BEGIN');
    await held.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
    expect(await service.cleanup({ now })).toMatchObject({ statusId: 'cleanup_locked', redactedSnapshotIds: [] });
    await held.query('ROLLBACK');

    await held.query('BEGIN');
    await held.query('SELECT id FROM policy_intent_rollback_snapshots WHERE id = 811 FOR UPDATE');
    expect(await service.cleanup({ now })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [812] });
  } finally {
    try {
      await held.query('ROLLBACK');
    } finally {
      held.release();
    }
  }
  expect(await service.cleanup({ now })).toMatchObject({ statusId: 'completed', redactedSnapshotIds: [811] });
  expect(await getStoredRows(intent.policyId)).toMatchObject([811, 812].map(id => ({
    id, event_intent_id: maximum, snapshot_payload: { retention_marker: { intent_id: maximum } },
  })));
});

test('rolls back the full batch when the second write acknowledges a different snapshot', async () => {
  const intent = await createIntent('write mismatch', 743);
  const first = '9007199254741000';
  const second = '9007199254741001';
  const later = '9007199254741002';
  await createSnapshot(intent, first);
  await createSnapshot(intent, second);
  await createSnapshot(intent, later);
  const original = await getStoredRows(intent.policyId);

  for (const [fault, reasonId] of [
    ['snapshot', 'snapshot_redaction_not_applied'],
    ['event', 'audit_event_not_written'],
    ['source', 'audit_event_not_written'],
    ['event_error', 'transaction_failed'],
  ]) {
    let changed = false;
    const transactionDb = { withTransaction: work => db.withTransaction(client => work({
      query: async (sql, params) => {
        if (fault === 'snapshot' && sql.includes('UPDATE policy_intent_rollback_snapshots') && params[0] === second) {
          const result = await client.query(sql, [later, ...params.slice(1)]);
          changed = result.rows[0]?.id === later;
          return result;
        }
        if (fault !== 'snapshot' && sql.includes('INSERT INTO policy_intent_migration_events')) {
          const metadata = JSON.parse(params[3]);
          if (metadata.snapshotId === second) {
            if (fault === 'event') metadata.snapshotId = later;
            if (fault === 'source') metadata.sourceAuditEventId = 700;
            // A non-object event payload is rejected by the real migration-event table constraint.
            const payload = fault === 'event_error' ? [] : metadata;
            changed = true;
            return client.query(sql, [...params.slice(0, 3), JSON.stringify(payload)]);
          }
        }
        return client.query(sql, params);
      },
    })) };
    const service = makeService(transactionDb);
    expect(await service.cleanup({ now, batchSize: 2 })).toMatchObject({
      statusId: 'failed_rolled_back', redactedSnapshotCount: 0,
      reason: { reasonId },
    });
    expect(changed).toBe(true);
    expect(await getStoredRows(intent.policyId)).toEqual(original);
  }

  expect(await makeService().cleanup({ now })).toMatchObject({
    statusId: 'completed', redactedSnapshotIds: [first, second, later], redactedSnapshotCount: 3,
  });
});
