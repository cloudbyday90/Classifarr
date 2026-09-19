/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter } from 'node:events';
import { expect, jest, test } from '@jest/globals';
import { createDatabaseModule } from '../config/database.mjs';
import { createDatabaseClientLease } from '../utils/databaseClientLease.mjs';

const fault = () => Object.assign(new Error('PRIVATE connection details'), { code: '25P03' });
function setup() {
  const client = Object.assign(new EventEmitter(), { query: jest.fn(async () => ({ rows: [{ acquired: true }] })), release: jest.fn() });
  const pool = { connect: jest.fn(async () => client), on: jest.fn() };
  const logger = { error: jest.fn(), warn: jest.fn() };
  const db = createDatabaseModule({ pgModule: { Pool: class { constructor() { return pool; } } },
    loggerFactory: () => logger, environment: { NODE_ENV: 'production' } });
  return { db, client, pool, logger };
}

test('lease preserves first error, aborts cooperatively, deduplicates, and hands off before removing listener', () => {
  const { client, logger } = setup(), lease = createDatabaseClientLease(client, { operation: 'transaction', logger });
  const first = fault();
  client.emit('error', first); client.emit('error', new Error('PRIVATE later failure'));
  expect(lease.signal.reason).toBe(first); expect(() => lease.assertHealthy()).toThrow(first);
  client.release.mockImplementation(() => { expect(client.listenerCount('error')).toBe(1); client.emit('error', fault()); });
  lease.release(); lease.release();
  expect(client.release).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(true);
  expect(client.listenerCount('error')).toBe(0);
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith('Database operation lost its checked-out connection',
    { operation: 'transaction', code: '25P03' }, { skipDbPersist: true });
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('PRIVATE');
});

test('idle pool errors also avoid raw driver details and recursive database logging', () => {
  const { pool, logger } = setup();
  pool.on.mock.calls.find(([event]) => event === 'error')[1](fault());
  expect(logger.error).toHaveBeenCalledWith('Unexpected error on idle client', { code: '25P03' }, { skipDbPersist: true });
});

test.each([null, { message: 'PRIVATE', code: 'PRIVATE' }, Object.assign(new Error('PRIVATE'), { code: 'ECONNRESET' })])(
  'normalizes malformed errors and only retains an allowlisted code %#', error => {
    const { client, logger } = setup(), lease = createDatabaseClientLease(client, { operation: 'query', logger });
    client.emit('error', error); expect(lease.signal.aborted).toBe(true); lease.release();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('PRIVATE');
  });

test('transaction waits for callback ownership to settle, never commits or retries after connection loss', async () => {
  const { db, client, pool } = setup(), error = fault();
  const callback = jest.fn(async (borrowed, { signal }) => {
    expect(borrowed).toBe(client);
    client.emit('error', error);
    await Promise.resolve();
    expect(signal.aborted).toBe(true); expect(client.release).not.toHaveBeenCalled();
    return 'not a success';
  });
  await expect(db.withTransaction(callback)).rejects.toBe(error);
  expect(callback).toHaveBeenCalledTimes(1); expect(pool.connect).toHaveBeenCalledTimes(1);
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN']);
  expect(client.release).toHaveBeenCalledWith(true); expect(client.listenerCount('error')).toBe(0);
});

test.each(['BEGIN', 'COMMIT'])('event during %s cannot return success or replay callback', async stage => {
  const { db, client } = setup(), error = fault(), callback = jest.fn(async () => 1);
  client.query.mockImplementation(async sql => { if (sql === stage) client.emit('error', error); return {}; });
  await expect(db.withTransaction(callback)).rejects.toBe(error);
  expect(callback).toHaveBeenCalledTimes(stage === 'BEGIN' ? 0 : 1);
  expect(client.query).not.toHaveBeenCalledWith('ROLLBACK'); expect(client.release).toHaveBeenCalledWith(true);
});

test('ordinary callback errors roll back and reuse a healthy client; failed cleanup preserves original error', async () => {
  const { db, client, logger } = setup(), error = new Error('PRIVATE callback');
  await expect(db.withTransaction(async () => { throw error; })).rejects.toBe(error);
  expect(client.release).toHaveBeenLastCalledWith();
  client.query.mockImplementation(async sql => { if (sql === 'ROLLBACK') throw new Error('PRIVATE rollback'); return {}; });
  await expect(db.withTransaction(async () => { throw error; })).rejects.toBe(error);
  expect(client.release).toHaveBeenLastCalledWith(true);
  expect(JSON.stringify(logger.error.mock.calls)).not.toContain('PRIVATE');
});

test('uncertain commit failure destroys the client even if rollback succeeds, without replay', async () => {
  const { db, client, pool } = setup(), error = new Error('commit failed'), callback = jest.fn(async () => 1);
  client.query.mockImplementation(async sql => { if (sql === 'COMMIT') throw error; return {}; });
  await expect(db.withTransaction(callback)).rejects.toBe(error);
  expect(callback).toHaveBeenCalledTimes(1); expect(pool.connect).toHaveBeenCalledTimes(1);
  expect(client.release).toHaveBeenCalledWith(true);
});

test('query and health-check own error events and discard failed connections', async () => {
  const { db, client } = setup(), error = fault();
  client.query.mockImplementation(async () => { client.emit('error', error); return { rows: [] }; });
  await expect(db.query('SELECT 1')).rejects.toBe(error);
  expect(await db.healthCheck()).toEqual({ healthy: false, error: 'Database connection failed' });
  expect(client.release.mock.calls).toEqual([[true], [true]]); expect(client.listenerCount('error')).toBe(0);
});

test('session locks cannot succeed on a broken connection and failed unlock cannot mask callback error', async () => {
  const { db, client } = setup(), error = fault();
  await expect(db.withSessionAdvisoryLock(123, async ({ signal }) => {
    client.emit('error', error); expect(signal.aborted).toBe(true);
  })).rejects.toBe(error);
  expect(client.query).not.toHaveBeenCalledWith('SELECT pg_advisory_unlock($1)', [123]);
  expect(client.release).toHaveBeenCalledWith(true);
  client.query.mockImplementation(async sql => {
    if (sql.includes('unlock')) throw new Error('unlock failed'); return { rows: [{ acquired: true }] };
  });
  const original = new Error('original');
  await expect(db.withSessionAdvisoryLock(123, async () => { throw original; })).rejects.toBe(original);
  expect(client.release).toHaveBeenLastCalledWith(true);
});

test('lost lock rejects subsequent wrapper operations while an unrelated request can recover', async () => {
  const { db, client, pool } = setup(), error = fault(), callback = jest.fn();
  await expect(db.withSessionAdvisoryLock(123, async () => {
    client.emit('error', error);
    await expect(db.query('SELECT 1')).rejects.toBe(error);
    await expect(db.withTransaction(callback)).rejects.toBe(error);
    await expect(db.withSessionAdvisoryLock(456, callback)).rejects.toBe(error);
  })).rejects.toBe(error);
  expect(pool.connect).toHaveBeenCalledTimes(1); expect(callback).not.toHaveBeenCalled();
  await expect(db.query('SELECT 1')).resolves.toBeDefined();
});

test('lock lost during child connection acquisition releases without issuing its query', async () => {
  const { db, client, pool } = setup(), error = fault();
  const child = { query: jest.fn(), release: jest.fn() };
  pool.connect.mockResolvedValueOnce(client).mockImplementationOnce(async () => {
    client.emit('error', error); return child;
  });
  await expect(db.withSessionAdvisoryLock(123, () => db.query('SELECT 1'))).rejects.toBe(error);
  expect(child.query).not.toHaveBeenCalled(); expect(child.release).toHaveBeenCalledWith(true);
});

test('lost enclosing lock rolls back a separate child transaction before commit', async () => {
  const { db, client, pool } = setup(), error = fault();
  const child = { query: jest.fn(async () => ({})), release: jest.fn() };
  pool.connect.mockResolvedValueOnce(client).mockResolvedValueOnce(child);
  await expect(db.withSessionAdvisoryLock(123, () => db.withTransaction(async () => {
    client.emit('error', error); return 1;
  }))).rejects.toBe(error);
  expect(child.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK']);
});

test('detached callback work cannot issue queries after its lock scope closes', async () => {
  const { db, pool } = setup();
  let continueWork, detached;
  await db.withSessionAdvisoryLock(123, async () => {
    const gate = new Promise(resolve => { continueWork = resolve; });
    detached = gate.then(() => db.query('SELECT 1'));
  });
  continueWork();
  await expect(detached).rejects.toThrow('database_lock_scope_closed');
  expect(pool.connect).toHaveBeenCalledTimes(1);
});
