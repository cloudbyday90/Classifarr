/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createLegacyEnrichmentRetryService } from '../services/legacyEnrichmentRetryService.mjs';
import { readLegacyRetryReceipt, recoverLegacyRetries } from '../services/legacyEnrichmentRetryRepository.mjs';

// SQL orchestration coverage only; real lock/rollback guarantees are tested with PostgreSQL.
function fixture() {
  const itemState = { syncItemState: jest.fn() }, onRecovered = jest.fn();
  const snapshot = { library: { id: 1, name: 'Synthetic', is_active: true, media_type: 'movie', revision: '1' },
    rows: [{ id: 2, media_item_id: 3, title: 'Synthetic', media_type: 'movie', attempts: 0, max_attempts: 3, enrichment_type: 'omdb', retry_revision: '1' }] };
  let receipt;
  const db = { query: jest.fn(async (sql, params) => {
    if (sql.startsWith('SET')) return { rows: [] };
    if (sql.includes('FROM users')) return { rows: [{ role: 'admin', is_active: true }] };
    if (sql.includes('FROM audit_log')) return { rows: receipt ? [receipt] : [] };
    if (sql.includes('FROM enrichment_retry_queue erq')) return { rows: snapshot.rows };
    if (sql.includes('FROM libraries')) return { rows: snapshot.library ? [snapshot.library] : [] };
    if (sql.startsWith('UPDATE enrichment_retry_queue')) return { rowCount: 1, rows: [{ id: 2, media_item_id: 3, status: 'pending', attempts: 0, max_attempts: 3 }] };
    if (sql.startsWith('INSERT INTO audit_log')) { receipt = { id: 9, user_id: params[0], created_at: 'synthetic', metadata: JSON.parse(params[2]) }; return { rows: [] }; }
    throw new Error('Unexpected SQL');
  }) };
  db.withTransaction = work => work(db);
  const service = createLegacyEnrichmentRetryService(db, { itemState, onRecovered });
  return { db, service, snapshot, itemState, onRecovered };
}
test('read-only preview, transactional item state, receipt and post-commit wake-up are ordered', async () => {
  const { db, service, itemState, onRecovered } = fixture();
  const preview = await service.preview(7, 1), requestId = randomUUID();
  expect(db.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(await service.receipt(7, 1, requestId)).toEqual({ receipt: null });
  const result = await service.confirm(7, 1, { requestId, workersStopped: true }, preview.revision);
  expect(result).toMatchObject({ repeated: false, receipt: { queued: 1, exhausted: 0, auditId: 9 } });
  expect(itemState.syncItemState).toHaveBeenCalledWith(3, db);
  expect(await service.confirm(7, 1, { requestId, workersStopped: true }, preview.revision)).toEqual({ ...result, repeated: true });
  expect(onRecovered).toHaveBeenCalledTimes(1);
  expect(await service.receipt(7, 1, requestId)).toEqual({ receipt: result.receipt });
  await expect(service.receipt(8, 1, requestId)).rejects.toMatchObject({ status: 409 });
});
test('changed or empty snapshot rejects without state synchronization or wake-up', async () => {
  const { service, snapshot, itemState, onRecovered } = fixture();
  const preview = await service.preview(7, 1), body = { requestId: randomUUID(), workersStopped: true };
  snapshot.rows[0].retry_revision = 'new';
  await expect(service.confirm(7, 1, body, preview.revision)).rejects.toMatchObject({ status: 412 });
  snapshot.rows = [];
  await expect(service.confirm(7, 1, body, (await service.preview(7, 1)).revision)).rejects.toMatchObject({ status: 409 });
  expect(itemState.syncItemState).not.toHaveBeenCalled(); expect(onRecovered).not.toHaveBeenCalled();
  snapshot.library = null;
  await expect(service.preview(7, 1)).rejects.toMatchObject({ status: 404 });
});
test('row count mismatch fails before derived state or receipt writes', async () => {
  const { snapshot, itemState } = fixture(), db = { query: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }) };
  await expect(recoverLegacyRetries(db, snapshot, {}, itemState)).rejects.toMatchObject({ status: 409 });
  expect(db.query).toHaveBeenCalledTimes(1); expect(itemState.syncItemState).not.toHaveBeenCalled();
});
test.each([null, {}, { version: 1, workersStopped: true, verification: 'administrator_attestation', revision: '"'+'a'.repeat(64)+'"', records: [] }])('invalid receipt %p cannot claim success', async metadata => {
  const db = { query: async () => ({ rows: [{ metadata }] }) };
  await expect(readLegacyRetryReceipt(db, { requestId: randomUUID() })).rejects.toMatchObject({ status: 503 });
});
test('a wake-up failure does not change a committed result', async () => {
  const { service, onRecovered } = fixture(); onRecovered.mockRejectedValueOnce(new Error('offline'));
  const preview = await service.preview(7, 1);
  expect(await service.confirm(7, 1, { requestId: randomUUID(), workersStopped: true }, preview.revision)).toMatchObject({ receipt: { auditId: 9 } });
});
