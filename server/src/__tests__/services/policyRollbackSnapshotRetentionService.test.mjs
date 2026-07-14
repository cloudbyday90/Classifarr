/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

import {
  DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE,
  POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS,
  buildRedactedRollbackSnapshotPayload,
  normalizeRetentionBatchSize,
} from '../../services/policyRollbackSnapshotRetentionContract.mjs';
import {
  PolicyRollbackSnapshotRetentionService,
} from '../../services/policyRollbackSnapshotRetentionService.mjs';

const NOW = '2026-07-14T12:00:00.000Z';

function snapshot(overrides = {}) {
  return {
    id: 901,
    intent_id: 101,
    policy_id: 44,
    snapshot_version: 2,
    snapshot_payload: {
      legacy_policy: {
        custom_signals: { genres: { require_any: ['Animation'] } },
        secret: 'must-not-leak',
      },
      presets: [{ custom_signals: { genres: { boost: ['Family'] } } }],
    },
    payload_redacted: false,
    restore_path: 'policy/rollback/policies/44/v2',
    expires_at: NOW,
    created_at: '2026-06-30T12:00:00.000Z',
    restored_at: null,
    ...overrides,
  };
}

function sourceEvent(overrides = {}) {
  return {
    id: 420,
    actor_type: 'operator',
    actor_id: 7,
    reason_code: 'library_rebuild_snapshot_persisted',
    metadata: { actorSourceId: 'manual_operator' },
    ...overrides,
  };
}

function createClient({
  snapshots = [snapshot()],
  sourceEvents = [sourceEvent()],
  lockAcquired = true,
  redactSnapshot = true,
  writeEvent = true,
} = {}) {
  const calls = [];
  const client = {
    calls,
    query: jest.fn(async (sql, params = []) => {
      const statement = String(sql);
      calls.push({ sql: statement, params });

      if (statement.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: lockAcquired }], rowCount: 1 };
      }
      if (statement.includes('FROM policy_intent_rollback_snapshots')) {
        return { rows: snapshots, rowCount: snapshots.length };
      }
      if (statement.includes('FROM policy_intent_migration_events')) {
        const next = sourceEvents.shift() || null;
        return { rows: next ? [next] : [], rowCount: next ? 1 : 0 };
      }
      if (statement.includes('UPDATE policy_intent_rollback_snapshots')) {
        return {
          rows: redactSnapshot ? [{ id: params[0] }] : [],
          rowCount: redactSnapshot ? 1 : 0,
        };
      }
      if (statement.includes('INSERT INTO policy_intent_migration_events')) {
        return {
          rows: writeEvent ? [{ id: 601 }] : [],
          rowCount: writeEvent ? 1 : 0,
        };
      }
      return { rows: [], rowCount: 0 };
    }),
  };

  return client;
}

function createDb(client) {
  return {
    withTransaction: jest.fn(async work => work(client)),
  };
}

function createLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

describe('policyRollbackSnapshotRetentionService', () => {
  test('normalizes a bounded cleanup batch size', () => {
    expect(normalizeRetentionBatchSize(0)).toBe(
      DEFAULT_POLICY_ROLLBACK_SNAPSHOT_RETENTION_BATCH_SIZE
    );
    expect(normalizeRetentionBatchSize(999)).toBe(500);
    expect(normalizeRetentionBatchSize(25)).toBe(25);
  });

  test('builds a minimal marker with audit metadata and no legacy payload values', () => {
    const marker = buildRedactedRollbackSnapshotPayload({
      snapshot: snapshot(),
      sourceEvent: sourceEvent(),
      now: NOW,
    });
    const serialized = JSON.stringify(marker);

    expect(marker).toEqual({
      retention_marker: expect.objectContaining({
        version: 1,
        state: 'expired_payload_redacted',
        policy_id: 44,
        intent_id: 101,
        snapshot_version: 2,
        restore_path: 'policy/rollback/policies/44/v2',
        source_audit: {
          migration_event_id: 420,
          actor_type: 'operator',
          actor_id: 7,
          actor_source_id: 'manual_operator',
          reason_code: 'library_rebuild_snapshot_persisted',
        },
        payload_digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        payload_bytes: expect.any(Number),
      }),
    });
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('Animation');
    expect(serialized).not.toContain('Family');
  });

  test('redacts an expired payload at the exact expiry boundary under one transaction lock', async () => {
    const client = createClient();
    const db = createDb(client);
    const logger = createLogger();
    const service = new PolicyRollbackSnapshotRetentionService({ db, logger, lockKey: 2007 });

    const result = await service.cleanup({ now: NOW, batchSize: 10 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.COMPLETED,
      batchSize: 10,
      redactedSnapshotCount: 1,
      redactedSnapshotIds: [901],
      hasMore: false,
      rawPayloadExposed: false,
      sideEffects: {
        payloadsRedacted: true,
        migrationEventsWritten: true,
        rollbackSnapshotsDeleted: false,
        nativeAuthorityChanged: false,
        legacyRowsChanged: false,
      },
    }));
    expect(db.withTransaction).toHaveBeenCalledTimes(1);
    expect(client.calls[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('pg_try_advisory_xact_lock'),
      params: [2007],
    }));
    expect(client.calls.find(call => call.sql.includes('FROM policy_intent_rollback_snapshots')))
      .toEqual(expect.objectContaining({
        sql: expect.stringContaining('expires_at <= $1::timestamptz'),
        params: [NOW, 10],
      }));
    expect(client.calls.find(call => call.sql.includes('FROM policy_intent_rollback_snapshots')).sql)
      .toContain('FOR UPDATE SKIP LOCKED');

    const redaction = client.calls.find(call =>
      call.sql.includes('UPDATE policy_intent_rollback_snapshots')
    );
    expect(redaction.params[0]).toBe(901);
    expect(redaction.params[2]).toBe(NOW);
    expect(redaction.params[1]).toContain('expired_payload_redacted');
    expect(redaction.params[1]).not.toContain('must-not-leak');
    expect(redaction.params[1]).not.toContain('Animation');

    const retentionEvent = client.calls.find(call =>
      call.sql.includes("'rollback_snapshot_payload_redacted'")
    );
    expect(retentionEvent.params[3]).toContain('sha256:');
    expect(retentionEvent.params[3]).not.toContain('must-not-leak');
    expect(logger.info).toHaveBeenCalledWith(
      'Policy rollback snapshot retention cleanup completed',
      expect.objectContaining({ redactedSnapshotCount: 1 })
    );
  });

  test('skips a concurrent cleanup without scanning or writing snapshots', async () => {
    const client = createClient({ lockAcquired: false });
    const logger = createLogger();
    const service = new PolicyRollbackSnapshotRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2007,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.CLEANUP_LOCKED);
    expect(result.redactedSnapshotCount).toBe(0);
    expect(client.calls).toHaveLength(1);
    expect(logger.debug).toHaveBeenCalledWith(
      'Policy rollback snapshot retention cleanup skipped',
      expect.objectContaining({ statusId: 'cleanup_locked' })
    );
  });

  test('is idempotent when there are no expired unredacted snapshots', async () => {
    const client = createClient({ snapshots: [] });
    const logger = createLogger();
    const service = new PolicyRollbackSnapshotRetentionService({ db: createDb(client), logger });

    const result = await service.cleanup({ now: NOW, batchSize: 5 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.COMPLETED,
      redactedSnapshotCount: 0,
      hasMore: false,
    }));
    expect(client.calls.some(call => call.sql.includes('UPDATE policy_intent_rollback_snapshots')))
      .toBe(false);
    expect(client.calls.some(call => call.sql.includes('INSERT INTO policy_intent_migration_events')))
      .toBe(false);
  });

  test('rolls back the batch when a payload cannot be redacted and returns no raw error', async () => {
    const client = createClient({ redactSnapshot: false });
    const logger = createLogger();
    const service = new PolicyRollbackSnapshotRetentionService({ db: createDb(client), logger });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK);
    expect(result.reason.reasonId).toBe('snapshot_redaction_not_applied');
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(client.calls.some(call => call.sql.includes('INSERT INTO policy_intent_migration_events')))
      .toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Policy rollback snapshot retention cleanup failed',
      expect.objectContaining({ riskId: 'snapshot_redaction_not_applied' })
    );
  });

  test('requires a transaction boundary before doing cleanup work', async () => {
    const service = new PolicyRollbackSnapshotRetentionService({
      db: {},
      logger: createLogger(),
    });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_ROLLBACK_SNAPSHOT_RETENTION_STATUS_IDS.TRANSACTION_BOUNDARY_REQUIRED
    );
    expect(result.reason.reasonId).toBe('transaction_boundary_required');
  });
});
