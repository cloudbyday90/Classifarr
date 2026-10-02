/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect, jest } from '@jest/globals';
import { projectRecoveryProgress, addRecoveryProgress } from '../services/ingestionRecoveryProgress.mjs';
import { verifyNextIngestionRecovery } from '../services/ingestionRecoveryVerification.mjs';
const receipt = { auditId: 1, requestId: 'request', libraryId: 2 };
const base = { request_id: 'request', library_id: 2, stage: 'requested', run_id: 'run', current_run_id: 'run',
  source_matches: true, library_enabled: true, source_enabled: true, configured: true, owner_active: true };
test('unlinked historical receipts are not inferred from newer work', () => {
  expect(projectRecoveryProgress(null, receipt)).toEqual({ stage: 'not_tracked', reason: 'older_receipt' });
  expect(() => projectRecoveryProgress({ ...base, request_id: 'another' }, receipt)).toThrow('could not be verified');
  expect(() => projectRecoveryProgress({ ...base, library_id: 3 }, receipt)).toThrow('could not be verified');
});
test.each([
  [{}, 'requested', undefined], [{ library_enabled: false }, 'blocked', 'disabled'],
  [{ source_enabled: false }, 'blocked', 'disabled'], [{ archived_at: 'date' }, 'blocked', 'disabled'],
  [{ configured: false }, 'blocked', 'unconfigured'], [{ source_matches: false }, 'superseded', 'source_changed'],
  [{ current_run_id: 'new' }, 'superseded', 'new_scan'], [{ foreign_markers: true }, 'blocked', 'ownership_review'],
  [{ source_cooling: true }, 'waiting', 'source_retry'],
  [{ stage: 'importing', owner_active: false }, 'waiting', 'import_retry'],
  [{ stage: 'importing', ingestion_phase: 'retry_wait' }, 'waiting', 'import_retry'],
  [{ stage: 'backfilling', identity_unresolved: true }, 'blocked', 'source_ids'],
  [{ stage: 'backfilling' }, 'backfilling', 'enqueue_pending'],
  [{ stage: 'backfilling', handoff_complete: true }, 'backfilling', 'verification_pending'],
  [{ stage: 'backfilling', handoff_complete: true, metadata_blocked: 1 }, 'blocked', 'metadata_failures'],
  [{ stage: 'backfilling', handoff_complete: true, checked_at: 'date' }, 'backfilling', 'metadata_pending'],
  [{ stage: 'completed', source_matches: false, library_enabled: false }, 'completed', undefined],
  [{ stage: 'superseded', reason: 'new_recovery' }, 'superseded', 'new_recovery'],
])('projects only justified stage %s', (patch, stage, reason) => {
  const result = projectRecoveryProgress({ ...base, ...patch, secret: 'never-return' }, receipt);
  expect(result).toMatchObject({ stage, reason });
  expect(JSON.stringify(result)).not.toContain('never-return');
  expect(result).not.toHaveProperty('run_id');
});
test('history uses a single bounded bulk read and never writes or claims ownership', async () => {
  const db = { query: jest.fn(async () => ({ rows: [{ ...base, audit_id: 1 }] })) };
  expect(await addRecoveryProgress(db, { libraryId: 2 }, [])).toEqual([]);
  expect(db.query).not.toHaveBeenCalled();
  const result = await addRecoveryProgress(db, { libraryId: 2 }, [receipt]);
  expect(result[0].progress.stage).toBe('requested');
  expect(db.query.mock.calls[0][1]).toEqual([[1], 2]);
  expect(db.query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE|pg_try/);
});
test('no due demand never scans metadata; verifier failure cannot prevent normal refill', async () => {
  const query = jest.fn(async () => ({ rows: [] }));
  const db = { withTransaction: fn => fn({ query }) };
  expect(await verifyNextIngestionRecovery({ db })).toEqual({ status: 'idle' });
  expect(query.mock.calls.some(([sql]) => sql.includes('WITH evidence'))).toBe(false);
  const logger = { warn: jest.fn() };
  query.mockRejectedValue(new Error('synthetic database failure with private details'));
  expect(await verifyNextIngestionRecovery({ db, logger })).toEqual({ status: 'unavailable' });
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private details');
});
