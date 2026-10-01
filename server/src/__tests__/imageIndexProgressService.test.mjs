/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { createImageIndexProgressService } from '../services/imageIndexProgressService.mjs';

function fixture({ demand = true, gate = 'ready', mismatch = false, fail = null, phase = null } = {}) {
  const client = new EventEmitter();
  client.release = jest.fn();
  client.query = jest.fn(async sql => {
    if (fail && sql.includes(fail)) throw new Error('secret database error');
    if (sql.includes('SELECT rag_enabled')) return { rows: [{ rag_enabled: demand, rag_image_weight: 0.5,
      image_embedding_provider_mode: 'separate_local', local_configured: true }] };
    if (sql.includes('SELECT to_regtype')) return { rows: [{ available: true }] };
    if (sql.includes('SELECT gate_state')) return { rows: [{ gate_state: gate }] };
    if (sql.includes('c.relname AS name')) return { rows: mismatch ? [{ name: 'idx_embeddings_image_hnsw', relkind: 'r' }] : [] };
    if (sql.includes('pg_stat_progress_create_index')) return { rows: phase ? [{ phase }] : [] };
    if (sql.includes('WITH active_libraries')) return { rows: [{ readiness: 'ready' }] };
    return { rows: [] };
  });
  const database = { pool: { connect: jest.fn(async () => client) } };
  return { client, database, service: createImageIndexProgressService({ database }) };
}
afterEach(() => jest.useRealTimers());
test.each([
  [{}, 'awaiting_check'], [{ demand: false }, 'disabled'], [{ gate: null }, 'restore_verification_required'],
  [{ mismatch: true }, 'definition_mismatch'], [{ phase: 'building' }, 'building'],
])('bounded read-only report %j', async (options, reason) => {
  const { client, service } = fixture(options);
  expect((await service.getReport()).reason).toBe(reason);
  const statements = client.query.mock.calls.map(([sql]) => sql);
  expect(statements[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  expect(statements).toContain("SET LOCAL statement_timeout = '3s'");
  expect(statements.at(-1)).toBe('COMMIT');
  expect(statements.join('\n')).not.toMatch(/(?:INSERT INTO|UPDATE public|DELETE FROM|CREATE INDEX|pg_try_advisory)/);
  expect(client.release.mock.calls).toEqual([[true]]);
  expect(client.listenerCount('error')).toBe(0);
});
test('shares concurrent reads but never caches the next observation', async () => {
  const { database, service } = fixture();
  const a = service.getReport(), b = service.getReport();
  expect(a).toBe(b); await a;
  await service.getReport();
  expect(database.pool.connect).toHaveBeenCalledTimes(2);
});
test.each(['SELECT gate_state', 'c.relname AS name', 'COMMIT'])('redacts failure at %s and discards connection', async fail => {
  const { client, service } = fixture({ fail });
  expect(await service.getReport()).toMatchObject({ status: 'unavailable', reason: 'observation_failed', indexes: null, automatic: null });
  expect(client.release.mock.calls).toEqual([[true]]);
});
test('pool acquisition failure is unavailable, not healthy', async () => {
  const service = createImageIndexProgressService({ database: { pool: { connect: async () => { throw new Error('secret') } } } });
  expect(JSON.stringify(await service.getReport())).not.toContain('secret');
});
test('deadline prevents late query results from becoming a successful snapshot', async () => {
  jest.useFakeTimers();
  const { client, service } = fixture();
  let finish;
  client.query.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = service.getReport(); await Promise.resolve();
  await jest.advanceTimersByTimeAsync(10_000);
  finish({ rows: [] });
  expect((await pending).status).toBe('unavailable');
  expect(client.release).toHaveBeenCalledTimes(1);
});
test('connection errors are handled and cannot leak through the report', async () => {
  const { client, service } = fixture();
  client.query.mockImplementationOnce(async () => { client.emit('error', new Error('secret')); return { rows: [] }; });
  expect((await service.getReport()).status).toBe('unavailable');
  expect(client.release.mock.calls).toEqual([[true]]);
});
