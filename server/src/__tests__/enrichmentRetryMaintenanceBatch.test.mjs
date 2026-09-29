/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { runRetryMaintenanceBatch } from '../services/enrichmentRetryMaintenanceBatch.mjs';
import { RETRY_MAINTENANCE_OPERATIONS, RETRY_MAINTENANCE_BATCH_SIZE } from '../services/enrichmentRetryMaintenanceQueries.mjs';
import { runEnrichmentRetryMaintenance } from '../services/enrichmentRetryMaintenancePass.mjs';
import { dispatchEnrichmentRetries } from '../services/enrichmentRetryDispatch.mjs';

function batchFixture({ candidates = [], locked = [], updated = [] } = {}) {
  const client = { query: jest.fn(async sql => ({ rows: sql.includes('SELECT erq.id') ? candidates
    : sql.startsWith('SELECT id FROM media_server_items') ? locked
      : sql.includes('UPDATE enrichment_retry_queue') ? updated : [] })) };
  const db = { query: jest.fn(() => { throw new Error('pooled query outside transaction'); }),
    withTransaction: jest.fn(async work => work(client)) };
  const enrichmentItemStateService = { syncItemState: jest.fn(async id => ({ id })) };
  return { db, client, enrichmentItemStateService, logger: { info: jest.fn() } };
}

test.each([['unknown', null], ['toString', null], ['completed', 'untrusted']])('rejects operation/type %s %s before connecting', async (operation, type) => {
  const deps = batchFixture();
  await expect(runRetryMaintenanceBatch(deps, operation, type)).rejects.toThrow(TypeError);
  expect(deps.db.withTransaction).not.toHaveBeenCalled();
});

test.each(Object.keys(RETRY_MAINTENANCE_OPERATIONS))('%s selection is bounded, unclaimed and locked before guarded updates', operation => {
  const sql = RETRY_MAINTENANCE_OPERATIONS[operation];
  expect(sql.select).toContain(`LIMIT ${RETRY_MAINTENANCE_BATCH_SIZE} FOR UPDATE OF erq SKIP LOCKED`);
  for (const statement of [sql.select, sql.update]) {
    expect(statement).toContain('erq.claim_token IS NULL AND erq.claim_until IS NULL');
  }
  expect(sql.update).toContain('erq.id = ANY($4::integer[]) AND msi.id = ANY($5::integer[])');
});

test.each([
  ['empty', [], []],
  ['locked', [{ id: 1, media_item_id: 3 }], []],
  ['changed', [{ id: 1, media_item_id: 3 }], [{ id: 3 }]],
])('%s batches have no state writes or success log', async (_name, candidates, locked) => {
  const deps = batchFixture({ candidates, locked });
  await expect(runRetryMaintenanceBatch(deps, 'completed')).resolves.toBe(0);
  expect(deps.enrichmentItemStateService.syncItemState).not.toHaveBeenCalled();
  expect(deps.logger.info).not.toHaveBeenCalled();
  expect(deps.db.query).not.toHaveBeenCalled();
});

test('one checked-out client locks sorted unique items and synchronizes each once before commit logging', async () => {
  const candidates = [{ id: 8, media_item_id: 7 }, { id: 9, media_item_id: 3 }, { id: 10, media_item_id: 3 }];
  const deps = batchFixture({ candidates, locked: [{ id: 3 }, { id: 7 }], updated: candidates });
  deps.db.withTransaction.mockImplementation(async work => {
    const result = await work(deps.client);
    expect(deps.logger.info).not.toHaveBeenCalled();
    return result;
  });
  await expect(runRetryMaintenanceBatch(deps, 'completed', 'omdb')).resolves.toBe(3);
  expect(deps.client.query.mock.calls.slice(0, 5).map(([sql]) => sql)).toEqual([
    'SET TRANSACTION ISOLATION LEVEL READ COMMITTED', "SET LOCAL lock_timeout = '2s'",
    "SET LOCAL statement_timeout = '10s'", "SET LOCAL idle_in_transaction_session_timeout = '10s'",
    "SET LOCAL transaction_timeout = '15s'",
  ]);
  expect(deps.client.query.mock.calls[6][1]).toEqual([[3, 7]]);
  expect(deps.client.query.mock.calls[7][1]).toEqual(['omdb', 'tavily_monthly_quota_deferred', expect.any(String), [8, 9, 10], [3, 7]]);
  expect(deps.enrichmentItemStateService.syncItemState.mock.calls).toEqual([[3, deps.client], [7, deps.client]]);
  expect(deps.logger.info).toHaveBeenCalledWith('Enrichment retry maintenance batch committed',
    { operation: 'completed', enrichmentType: 'omdb', updated: 3, durationMs: expect.any(Number) });
  expect(deps.db.query).not.toHaveBeenCalled();
});

test.each([null, {}, { id: 2 }])('missing or wrong derived-state receipt %j aborts the transaction', async receipt => {
  const candidates = [{ id: 1, media_item_id: 3 }];
  const deps = batchFixture({ candidates, locked: [{ id: 3 }], updated: candidates });
  deps.enrichmentItemStateService.syncItemState.mockResolvedValue(receipt);
  await expect(runRetryMaintenanceBatch(deps, 'completed')).rejects.toThrow('retry_maintenance_state_missing');
  expect(deps.logger.info).not.toHaveBeenCalled();
});

function passFixture() {
  return {
    recoverStaleProcessingRetries: jest.fn().mockResolvedValue(0),
    normalizeTavilyMonthlyDeferredRows: jest.fn().mockResolvedValue(0),
    resolveRetriesWithExistingMetadata: jest.fn().mockResolvedValue(0),
    failExhaustedPendingRetries: jest.fn().mockResolvedValue(0),
    retryWakeEpoch: 1,
    db: { query: jest.fn().mockResolvedValue({ rows: [] }) },
    processRetryQueue: jest.fn().mockResolvedValue({ processed: 0 }),
    scheduleProcessing: jest.fn(), logger: { info: jest.fn() },
  };
}

test.each([null, 'tavily', 'omdb', 'web_search', 'tmdb'])('maintenance scopes %s and runs each phase once in order', async type => {
  const deps = passFixture();
  expect(await runEnrichmentRetryMaintenance(deps, type)).toEqual({ recovered: 0, normalized: 0, resolved: 0, autoFailed: 0, needsContinuation: false });
  const methods = [deps.recoverStaleProcessingRetries, deps.resolveRetriesWithExistingMetadata, deps.failExhaustedPendingRetries];
  for (const method of methods) expect(method.mock.calls).toEqual([[type]]);
  if (type === null || type === 'tavily') {
    expect(deps.normalizeTavilyMonthlyDeferredRows.mock.calls).toEqual([[]]);
    methods.splice(1, 0, deps.normalizeTavilyMonthlyDeferredRows);
  } else expect(deps.normalizeTavilyMonthlyDeferredRows).not.toHaveBeenCalled();
  const order = methods.map(method => method.mock.invocationCallOrder[0]);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test.each(['recoverStaleProcessingRetries', 'normalizeTavilyMonthlyDeferredRows', 'resolveRetriesWithExistingMetadata', 'failExhaustedPendingRetries'])('a full %s stage requests one continuation without looping', async method => {
  const service = passFixture(); service[method].mockResolvedValue(50);
  await dispatchEnrichmentRetries(service);
  expect(service[method]).toHaveBeenCalledTimes(1);
  expect(service.scheduleProcessing.mock.calls).toEqual([[5000]]);
  expect(service.processRetryQueue).not.toHaveBeenCalled();
});

test('dispatch runs global maintenance once, not again for each eligible provider', async () => {
  const service = passFixture(); service.db.query.mockResolvedValue({ rows: [{ id: 1 }] });
  await dispatchEnrichmentRetries(service);
  expect(service.resolveRetriesWithExistingMetadata.mock.calls).toEqual([[null]]);
  expect(service.processRetryQueue.mock.calls).toEqual(['omdb', 'web_search', 'tavily'].map(type => [50, type, { maintenance: false }]));
  expect(service.scheduleProcessing).not.toHaveBeenCalled();
});

test('cancellation after maintenance prevents provider dispatch and resurrected wake-ups', async () => {
  const service = passFixture(); service.db.query.mockResolvedValue({ rows: [{ id: 1 }] });
  service.failExhaustedPendingRetries.mockImplementation(async () => { service.retryWakeEpoch++; return 50; });
  await dispatchEnrichmentRetries(service);
  expect(service.db.query).not.toHaveBeenCalled();
  expect(service.processRetryQueue).not.toHaveBeenCalled();
  expect(service.scheduleProcessing).not.toHaveBeenCalled();
});

test('provider dispatch failure still continues a committed full maintenance batch', async () => {
  const service = passFixture(); service.resolveRetriesWithExistingMetadata.mockResolvedValue(50);
  service.db.query.mockRejectedValue(new Error('dispatch unavailable'));
  await expect(dispatchEnrichmentRetries(service)).rejects.toThrow('dispatch unavailable');
  expect(service.scheduleProcessing.mock.calls).toEqual([[5000]]);
});

test('maintenance failure stops later stages and cannot report progress or schedule a spin', async () => {
  const service = passFixture(); service.normalizeTavilyMonthlyDeferredRows.mockRejectedValue(new Error('database unavailable'));
  await expect(dispatchEnrichmentRetries(service)).rejects.toThrow('database unavailable');
  expect(service.resolveRetriesWithExistingMetadata).not.toHaveBeenCalled();
  expect(service.db.query).not.toHaveBeenCalled();
  expect(service.scheduleProcessing).not.toHaveBeenCalled();
});
