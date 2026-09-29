/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createQueueClaimWriteGuard, QueueClaimWriteError } from '../services/queueClaimWriteGuard.mjs';
import { createQueueEnrichmentWriteSession } from '../services/queueEnrichmentWriteSession.mjs';
import { QueueOmdbEnrichmentService } from '../services/queueOmdbEnrichmentService.mjs';

const token = 'b618a81b-bf02-4f3c-96db-8cd12a1073d2';
function fixture() {
  const query = jest.fn(async sql => {
    if (sql.includes('FOR UPDATE')) return { rows: [{ deadline: '2026-09-30 12:00:00+00' }] };
    if (sql.includes('clock_timestamp')) return { rows: [{ live: true }] };
    return { rows: [{ task_type: 'metadata_enrichment' }] };
  });
  const db = { withTransaction: jest.fn(fn => fn({ query })) };
  return { query, db, guard: createQueueClaimWriteGuard(db, { id: 1, claim_token: token }) };
}

test.each([undefined, null, '', 'wrong', 1])('missing/invalid received token %j fails before DB use', async claim_token => {
  const { db } = fixture();
  await expect(createQueueClaimWriteGuard(db, { id: 1, claim_token }).query('UPDATE ignored'))
    .rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(db.withTransaction).not.toHaveBeenCalled();
});

test('no transaction fallback, immutable received authority and inert escaped client', async () => {
  const query = jest.fn();
  await expect(createQueueClaimWriteGuard({ query }, { id: 1, claim_token: token }).query('UPDATE ignored'))
    .rejects.toBeInstanceOf(QueueClaimWriteError);
  expect(query).not.toHaveBeenCalled();
  const f = fixture();
  const task = { id: 1, claim_token: token };
  const guard = createQueueClaimWriteGuard(f.db, task);
  task.claim_token = 'changed'; task.id = 99;
  let escaped;
  await guard.run(async client => { escaped = client; await client.query('UPDATE fixture'); });
  expect(f.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), [1, token]);
  const count = f.query.mock.calls.length;
  await expect(escaped.query('UPDATE late')).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(f.query).toHaveBeenCalledTimes(count);
});

test.each(['missing', 'expired', 'expires_during_work'])('rejects %s claim', async scenario => {
  const f = fixture(); let clocks = 0;
  f.query.mockImplementation(async sql => {
    if (sql.includes('FOR UPDATE')) return { rows: scenario === 'missing' ? [] : [{ deadline: '2026-09-30' }] };
    if (sql.includes('clock_timestamp')) return { rows: [{ live: scenario !== 'expired' && ++clocks === 1 }] };
    return { rows: [] };
  });
  const work = jest.fn();
  await expect(f.guard.run(work)).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(work).toHaveBeenCalledTimes(scenario === 'expires_during_work' ? 1 : 0);
});

test('DB failure is not a provider failure and does not fall back or replay', async () => {
  const f = fixture();
  f.db.withTransaction.mockRejectedValue(new Error('private connection detail'));
  await expect(f.guard.query('UPDATE fixture')).rejects.toMatchObject({ message: 'queue_claim_write_failed' });
  expect(f.db.withTransaction).toHaveBeenCalledTimes(1);
});

test('retry scheduling and success reporting happen only after a successful commit', async () => {
  const f = fixture();
  const state = { syncItemState: jest.fn(), markProcessing: jest.fn() };
  const retryService = { queueForRetry: jest.fn(), scheduleProcessing: jest.fn() };
  const logger = { info: jest.fn() };
  f.db.withTransaction.mockImplementation(async fn => {
    await fn({ query: f.query });
    expect(retryService.scheduleProcessing).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    throw new Error('commit failed');
  });
  const session = createQueueEnrichmentWriteSession({ db: f.db, task: { id: 1, claim_token: token },
    logger, enrichmentItemStateService: state, retryService });
  await expect(session.queueRetry(2, 'omdb', 'missing', 5)).rejects.toBeInstanceOf(QueueClaimWriteError);
  await expect(session.finish({ enriched: true }, 2)).rejects.toBeInstanceOf(QueueClaimWriteError);
  expect(retryService.scheduleProcessing).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
});

test('successful writes use the scoped client and notify after commit', async () => {
  const f = fixture(); let committed = false;
  f.db.withTransaction.mockImplementation(async fn => {
    const result = await fn({ query: f.query }); committed = true; return result;
  });
  const state = { syncItemState: jest.fn(), markProcessing: jest.fn() };
  const retryService = { queueForRetry: jest.fn(), scheduleProcessing: jest.fn(() => expect(committed).toBe(true)) };
  const logger = { info: jest.fn(() => expect(committed).toBe(true)) };
  const session = createQueueEnrichmentWriteSession({ db: f.db, task: { id: 1, claim_token: token },
    logger, enrichmentItemStateService: state, retryService });
  await session.markProcessing(2);
  expect(state.markProcessing).toHaveBeenCalledWith(2, expect.objectContaining({ query: expect.any(Function) }));
  committed = false;
  await session.queueRetry(2, 'omdb', 'missing', 5);
  expect(retryService.queueForRetry).toHaveBeenCalledWith(2, 'omdb', 'missing', 5, expect.any(Object));
  committed = false;
  let sameClient;
  await session.finish({ enriched: true }, 2, async client => { sameClient = client; });
  expect(state.syncItemState).toHaveBeenCalledWith(2, sameClient);
  expect(logger.info).toHaveBeenCalledTimes(1);
});

test('an acknowledgement rejection aborts final state synchronization', async () => {
  const f = fixture(); const original = f.query.getMockImplementation();
  f.query.mockImplementation(sql => sql.startsWith('UPDATE task_queue') ? { rows: [] } : original(sql));
  const state = { syncItemState: jest.fn() }, logger = { info: jest.fn() };
  const session = createQueueEnrichmentWriteSession({ db: f.db, task: { id: 1, claim_token: token },
    logger, enrichmentItemStateService: state });
  await expect(session.finish({ enriched: true }, 2)).rejects.toMatchObject({ reason: 'queue_claim_not_owned' });
  expect(state.syncItemState).not.toHaveBeenCalled();
  expect(logger.info).not.toHaveBeenCalled();
});

test.each(['queue_claim_not_owned', 'queue_claim_write_failed'])('OMDb preserves %s without reporting a provider fault', async reason => {
  const logger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn() };
  const warnProviderRuntimeFailure = jest.fn();
  const service = new QueueOmdbEnrichmentService({ logger,
    db: { query: jest.fn().mockResolvedValue({ rows: [{ api_key: 'fixture-only' }] }) },
    omdbService: { getByTitle: jest.fn().mockResolvedValue(null) },
    metadataProviderIntegrityService: { warnProviderRuntimeFailure },
  });
  const failure = new QueueClaimWriteError(reason);
  const persistence = { query: jest.fn(), queueRetry: jest.fn().mockRejectedValue(failure) };
  await expect(service.enrich({ itemId: 1, media_type: 'movie', title: 'Fixture' }, {}, persistence)).rejects.toBe(failure);
  expect(warnProviderRuntimeFailure).not.toHaveBeenCalled();
  expect(persistence.queueRetry).toHaveBeenCalledTimes(1);
});
