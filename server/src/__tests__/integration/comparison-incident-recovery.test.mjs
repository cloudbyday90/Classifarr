/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { randomUUID } from 'node:crypto';
import { afterEach, expect, jest, test } from '@jest/globals';
import { getPool, createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createComparisonIncidentRepository, COMPARISON_WARNING } from '../../services/comparisonIncidentRepository.mjs';
import { registerLiveMultiScaleSchedule } from '../../services/liveMultiScaleScheduler.mjs';
import { LoggerShim, setDb } from '../../utils/logging/loggerShim.mjs';

const metadataFor = (episodeId, scopeId) => ({ code: 'cached_vectors_incomplete', coverage: { missingDescriptions: 37 },
  comparisonIncident: { version: 1, episodeId, scopeId } });
const repository = () => createComparisonIncidentRepository(createIntegrationDatabaseModuleMock());
async function insert(metadata, extra = {}) {
  const { rows } = await getPool().query(`INSERT INTO error_log
    (level, module, message, metadata, resolved, resolution_notes, system_context)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`, [extra.level || 'WARN', extra.module || 'LibraryComparisonContext',
    extra.message || COMPARISON_WARNING, metadata, extra.resolved || false, extra.notes || null, { fixture: true }]);
  return rows[0];
}
afterEach(() => setDb(null));

test('exact warning resolution preserves original evidence and excludes foreign, legacy and manually resolved records', async () => {
  const episodeId = randomUUID(), scopeId = randomUUID(), metadata = metadataFor(episodeId, scopeId);
  const own = await insert(metadata);
  const protectedRows = await Promise.all([
    insert(metadataFor(randomUUID(), scopeId)), insert(metadataFor(episodeId, randomUUID())),
    insert({ code: 'cached_vectors_incomplete' }), insert(metadata, { resolved: true, notes: 'Operator verified' }),
    insert(metadata, { module: 'OtherModule' }), insert(metadata, { level: 'ERROR' }),
    insert(metadata, { message: 'Other warning' }), insert({ ...metadata, comparisonIncident: { ...metadata.comparisonIncident, version: 2 } }),
  ]);
  const unlisted = await insert(metadata);
  const request = { episodeId, scopeId, errorIds: [own, ...protectedRows].map(row => row.error_id), status: 'ready' };
  expect(await repository().resolve(request)).toEqual([own.error_id]);
  expect(await repository().resolve(request)).toEqual([]);
  const { rows: [updated] } = await getPool().query('SELECT * FROM error_log WHERE error_id = $1', [own.error_id]);
  expect(updated).toEqual({ ...own, resolved: true, resolved_at: expect.any(Date),
    resolution_notes: expect.stringContaining('Original evidence retained'), metadata: { ...metadata,
      comparisonRecovery: { version: 1, episodeId, scopeId, status: 'ready', observedAt: expect.any(String) } } });
  for (const row of [...protectedRows, unlisted]) {
    expect((await getPool().query('SELECT * FROM error_log WHERE error_id=$1', [row.error_id])).rows[0]).toEqual(row);
  }
});

test('real logger, scheduler and repository connect warning to recovery without changing coverage evidence', async () => {
  setDb({ query: (...args) => getPool().query(...args) });
  const pino = { bindings: () => ({ module: 'LibraryComparisonContext' }), warn: jest.fn(), info: jest.fn() };
  const scopeId = randomUUID(), worker = { stop: jest.fn(), getRecoveryScope: () => scopeId, run: jest.fn() };
  const scheduler = { schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerLiveMultiScaleSchedule(scheduler, { worker, log: new LoggerShim(pino), incidentRepository: repository() });
  const run = scheduler.schedule.mock.calls[0][2];
  try {
    worker.run.mockResolvedValue({ status: 'unavailable', failure: { stage: 'snapshot_read', code: 'cached_vectors_incomplete',
      coverage: { cachedDescriptions: 6307, eligibleDescriptions: 6308, missingDescriptions: 1 } } });
    await run(); await run();
    const lookup = () => getPool().query("SELECT * FROM error_log WHERE metadata->'comparisonIncident'->>'scopeId' = $1", [scopeId]);
    const before = await lookup(); expect(before.rows).toHaveLength(1); expect(before.rows[0].resolved).toBe(false);
    worker.run.mockResolvedValue({ status: 'deferred', reason: 'busy' }); await run();
    expect((await lookup()).rows[0].resolved).toBe(false);
    worker.run.mockResolvedValue({ status: 'revalidated' }); await run();
    const after = (await lookup()).rows[0]; expect(after.resolved).toBe(true);
    expect(after.metadata.coverage).toEqual(before.rows[0].metadata.coverage);
    expect(pino.info).toHaveBeenLastCalledWith(expect.objectContaining({
      comparisonRecovery: expect.objectContaining({ scopeId, resolvedCount: 1 }),
    }), 'Library comparison context recovered automatically');
  } finally { scheduler.liveMultiScaleWorker.stop(); }
});

test('owner change after update rolls back and a later owner cannot claim the old episode', async () => {
  const episodeId = randomUUID(), scopeId = randomUUID(), row = await insert(metadataFor(episodeId, scopeId));
  let checks = 0;
  await expect(repository().resolve({ episodeId, scopeId, errorIds: [row.error_id], status: 'ready',
    isCurrent: () => ++checks < 3 })).rejects.toThrow('owner changed');
  expect((await getPool().query('SELECT resolved FROM error_log WHERE error_id=$1', [row.error_id])).rows[0].resolved).toBe(false);
});

test('a locked warning times out without mutation and a subsequent verified update succeeds', async () => {
  const episodeId = randomUUID(), scopeId = randomUUID(), row = await insert(metadataFor(episodeId, scopeId));
  const request = { episodeId, scopeId, errorIds: [row.error_id], status: 'ready' };
  const lock = await getPool().connect();
  try {
    await lock.query('BEGIN'); await lock.query('SELECT 1 FROM error_log WHERE error_id=$1 FOR UPDATE', [row.error_id]);
    await expect(repository().resolve(request)).rejects.toMatchObject({ code: '55P03' });
    expect((await lock.query('SELECT resolved FROM error_log WHERE error_id=$1', [row.error_id])).rows[0].resolved).toBe(false);
  } finally { await lock.query('ROLLBACK'); lock.release(); }
  expect(await repository().resolve(request)).toEqual([row.error_id]);
});

test.each([
  { status: 'degraded' }, { episodeId: "'; DELETE FROM error_log; --" }, { scopeId: null }, { errorIds: [] },
  { errorIds: Array.from({ length: 129 }, () => randomUUID()) }, { errorIds: ['not-a-uuid'] },
])('invalid recovery input is refused before database access: %j', async invalid => {
  const database = { withTransaction: jest.fn() };
  await expect(createComparisonIncidentRepository(database).resolve({ episodeId: randomUUID(), scopeId: randomUUID(),
    errorIds: [randomUUID()], status: 'ready', ...invalid })).rejects.toThrow('Invalid comparison incident');
  expect(database.withTransaction).not.toHaveBeenCalled();
});
