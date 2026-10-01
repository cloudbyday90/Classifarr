/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createLegacyIngestionService } from '../services/legacyIngestionService.mjs';
import { projectReconciliationReceipt } from '../services/legacyIngestionReceipt.mjs';

const request = { actorId: 7, libraryId: 4 };
const record = () => ({ id: 9, user_id: 7, created_at: new Date('2026-09-30T12:00:00Z'), metadata: {
  version: 2, requestId: randomUUID(), libraryId: 4, workersStopped: true, verification: 'administrator_attestation',
  revision: `"${'a'.repeat(64)}"`, syncIds: [12], resume: true, replay: 'scheduled', privateField: 'not for client',
} });
function fixture({ rows = [], actor = { role: 'admin', is_active: true }, libraries = [{ id: 4 }] } = {}) {
  const query = jest.fn(async sql => {
    if (sql.includes('FROM users')) return { rows: [actor] };
    if (sql.includes('FROM libraries')) return { rows: libraries };
    if (sql.includes('FROM audit_log')) return { rows };
    return { rows: [] };
  });
  const withTransaction = jest.fn(callback => callback({ query })), own = jest.fn();
  return { query, own, withTransaction, service: createLegacyIngestionService({ withTransaction }, own) };
}

test('history is read-only, actor/library-scoped, bounded, and never claims ingestion ownership', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...record(), id: 30 - index }));
  const { query, own, service } = fixture({ rows });
  const result = await service.history('7', '4');
  expect(result).toMatchObject({ limit: 20, hasMore: true });
  expect(result.receipts).toHaveLength(20);
  expect(result.receipts.map(row => row.auditId)).toEqual(rows.slice(0, 20).map(row => row.id));
  expect(query.mock.calls[0][0]).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(query.mock.calls[1][0]).toBe("SET LOCAL statement_timeout='3s'");
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining('ORDER BY id DESC LIMIT $3'), [7, '4', 21]);
  expect(result.receipts[0]).toEqual({ auditId: 30, requestId: rows[0].metadata.requestId, libraryId: 4,
    confirmedAt: rows[0].created_at, status: 'reconciled', replay: 'scheduled' });
  expect(own).not.toHaveBeenCalled();
  expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
});

test('empty history is empty retained evidence, not a failed or completed recovery', async () => {
  const { service } = fixture();
  expect(await service.history(7, 4)).toEqual({ receipts: [], limit: 20, hasMore: false });
});

test.each([{ role: 'user', is_active: true }, { role: 'admin', is_active: false }, null])('rechecks current account access: %p', async actor => {
  const { service, query } = fixture({ actor });
  await expect(service.history(7, 4)).rejects.toMatchObject({ status: 403 });
  expect(query.mock.calls.some(([sql]) => sql.includes('audit_log'))).toBe(false);
});

test('missing library and invalid input never read audit history', async () => {
  const { service, query, withTransaction } = fixture({ libraries: [] });
  await expect(service.history('0', 4)).rejects.toMatchObject({ status: 400 });
  expect(withTransaction).not.toHaveBeenCalled();
  await expect(service.history(7, 4)).rejects.toMatchObject({ status: 404 });
  expect(query.mock.calls.some(([sql]) => sql.includes('audit_log'))).toBe(false);
});

test('version one remains maintenance-only and version two respects both handoff modes', () => {
  const row = record();
  row.metadata.resume = false; row.metadata.replay = 'waiting_for_enable';
  expect(projectReconciliationReceipt(row, request).replay).toBe('waiting_for_enable');
  row.metadata.version = 1; delete row.metadata.resume;
  expect(projectReconciliationReceipt(row, request).replay).toBe('waiting_for_enable');
});

test.each([
  { version: 0 }, { workersStopped: false }, { verification: 'guessed' }, { revision: 'stale' },
  { syncIds: null }, { requestId: 'not-a-uuid' }, { replay: 'complete' }, { resume: 'true' },
  { version: 1 }, { version: 1, resume: undefined, replay: 'scheduled' },
])('unverifiable saved receipt fails closed: %p', patch => {
  const row = record(); Object.assign(row.metadata, patch);
  expect(() => projectReconciliationReceipt(row, request)).toThrow(expect.objectContaining({ status: 503 }));
});

test.each([{ actorId: 8 }, { libraryId: 5 }, { requestId: randomUUID() }, { revision: 'different' }, { resume: false }])
  ('receipt scope remains bound to the request: %p', change => {
    expect(() => projectReconciliationReceipt(record(), { ...request, ...change }))
      .toThrow(expect.objectContaining({ status: 409, code: 'ingestion_request_mismatch' }));
  });
