/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS,
  POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS,
  PolicyObservedEvidenceProvenanceRetentionService,
} from '../../services/policyObservedEvidenceProvenanceRetentionService.mjs';

const NOW = '2026-08-05T12:00:00.000Z';

function snapshot(overrides = {}) {
  return {
    id: 901,
    establishment_id: 51,
    policy_id: 44,
    library_id: 6,
    intent_id: 101,
    snapshot_version: 1,
    source_id: 'stored_library_profile',
    capture_state: 'captured',
    capture_reason_id: 'stored_profile_captured',
    profile_freshness_state: 'current',
    source_profile_generated_at: '2026-07-22T11:58:00.000Z',
    source_profile_updated_at: '2026-07-22T11:59:00.000Z',
    evidence_fingerprint: 'a'.repeat(64),
    snapshot_payload: {
      evidence: { buckets: { compatibility_evidence: [{ label: 'Animation' }] } },
      private_value: 'must-not-leak',
    },
    expires_at: NOW,
    created_at: '2026-07-22T12:00:00.000Z',
    ...overrides,
  };
}

function createClient({ lockAcquired = true, snapshots = [snapshot()], redactSnapshot = true } = {}) {
  const calls = [];

  return {
    calls,
    query: jest.fn(async (sql, params = []) => {
      calls.push({ sql: String(sql), params });
      const statement = String(sql);
      if (statement.includes('pg_try_advisory_xact_lock')) {
        return { rows: [{ acquired: lockAcquired }] };
      }
      if (statement.includes('FROM policy_observed_evidence_provenance_snapshots')) {
        return { rows: snapshots };
      }
      if (statement.includes('UPDATE policy_observed_evidence_provenance_snapshots')) {
        return { rows: redactSnapshot ? [{ id: params[0] }] : [] };
      }
      return { rows: [] };
    }),
  };
}

function createDb(client) {
  return { withTransaction: jest.fn(async work => work(client)) };
}

function createLogger() {
  return { info: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

describe('PolicyObservedEvidenceProvenanceRetentionService', () => {
  test('redacts expired bounded evidence under one transaction advisory lock', async () => {
    const client = createClient();
    const logger = createLogger();
    const service = new PolicyObservedEvidenceProvenanceRetentionService({
      db: createDb(client),
      logger,
      lockKey: 2010,
    });

    const result = await service.cleanup({ now: NOW, batchSize: 10 });

    expect(result).toEqual(expect.objectContaining({
      statusId: POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.COMPLETED,
      redactedSnapshotCount: 1,
      redactedSnapshotIds: [901],
      rawPayloadExposed: false,
      sideEffects: expect.objectContaining({
        payloadsRedacted: true,
        snapshotsDeleted: false,
        policyAuthorityChanged: false,
      }),
    }));
    expect(client.calls[0]).toEqual(expect.objectContaining({
      sql: expect.stringContaining('pg_try_advisory_xact_lock'),
      params: [2010],
    }));
    const lockedRows = client.calls.find(call =>
      call.sql.includes('FROM policy_observed_evidence_provenance_snapshots')
    );
    expect(lockedRows.sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(lockedRows.params).toEqual([NOW, 10]);

    const redaction = client.calls.find(call =>
      call.sql.includes('UPDATE policy_observed_evidence_provenance_snapshots')
    );
    expect(redaction.params[1]).toContain('expired_payload_redacted');
    expect(redaction.params[1]).not.toContain('must-not-leak');
    expect(redaction.params[1]).not.toContain('Animation');
    expect(logger.info).toHaveBeenCalledWith(
      'Observed evidence provenance retention cleanup completed',
      expect.objectContaining({ redactedSnapshotCount: 1 })
    );
  });

  test('skips overlapping cleanup work before scanning provenance snapshots', async () => {
    const client = createClient({ lockAcquired: false });
    const logger = createLogger();
    const service = new PolicyObservedEvidenceProvenanceRetentionService({
      db: createDb(client),
      logger,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.CLEANUP_LOCKED
    );
    expect(client.calls).toHaveLength(1);
  });

  test('rolls back the batch without exposing raw payload when redaction fails', async () => {
    const client = createClient({ redactSnapshot: false });
    const logger = createLogger();
    const service = new PolicyObservedEvidenceProvenanceRetentionService({
      db: createDb(client),
      logger,
    });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.FAILED_ROLLED_BACK
    );
    expect(result.reason.reasonId).toBe(
      POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_RISK_IDS.SNAPSHOT_REDACTION_NOT_APPLIED
    );
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
    expect(logger.error).toHaveBeenCalledWith(
      'Observed evidence provenance retention cleanup failed',
      expect.objectContaining({ riskId: 'snapshot_redaction_not_applied' })
    );
  });

  test('requires a transaction before scanning or redacting provenance rows', async () => {
    const service = new PolicyObservedEvidenceProvenanceRetentionService({
      db: {},
      logger: createLogger(),
    });

    const result = await service.cleanup({ now: NOW });

    expect(result.statusId).toBe(
      POLICY_OBSERVED_EVIDENCE_PROVENANCE_RETENTION_STATUS_IDS.TRANSACTION_BOUNDARY_REQUIRED
    );
  });
});
