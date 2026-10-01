/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { EventEmitter, getEventListeners } from 'node:events';
import { jest } from '@jest/globals';
import { runAbortableDatabaseRead } from '../utils/databaseAbortableRead.mjs';
import { createDatabaseReadCanceller } from '../utils/databaseReadCancellation.mjs';
import { createDatabaseModule } from '../config/database.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const identity = { pid: 123, started: '2026-10-01 00:00:00.123456+00' };
function setup() {
  const client = Object.assign(new EventEmitter(), {
    query: jest.fn(async () => ({ rows: [identity] })), release: jest.fn(),
  });
  const controller = new AbortController();
  const dependencies = { connect: jest.fn(async () => client), cancelRead: jest.fn(async () => true),
    logger: { warn: jest.fn() }, assertActive: jest.fn() };
  return { client, controller, dependencies, run: (work, options = {}) => runAbortableDatabaseRead(dependencies,
    work, { signal: controller.signal, ...options }) };
}

test('read-only transaction preserves results, local timeout, and normal connection reuse', async () => {
  const { client, controller, dependencies, run } = setup();
  expect(await run(async ({ query }) => (await query('SELECT 1')).rows)).toEqual([identity]);
  expect(client.query.mock.calls[0]).toEqual(['BEGIN READ ONLY']);
  expect(client.query.mock.calls[1][0]).toContain("set_config('statement_timeout'");
  expect(client.query.mock.calls[1][1][0]).toBeGreaterThan(0);
  expect(client.query).toHaveBeenLastCalledWith('COMMIT');
  expect(client.release).toHaveBeenCalledWith();
  controller.abort(); expect(dependencies.cancelRead).not.toHaveBeenCalled();
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  expect(client.listenerCount('error')).toBe(0);
});

test('a retained facade cannot run queries after a successful transaction closes', async () => {
  const { run, client } = setup(); let facade;
  await run(async db => { facade = db; });
  await expect(facade.query('late query')).rejects.toThrow('database_read_closed');
  expect(client.query).not.toHaveBeenCalledWith('late query');
});

test('already-aborted reads never acquire; invalid budgets never acquire', async () => {
  const { controller, dependencies, run } = setup();
  for (const timeoutMs of [0, -1, 15001, NaN, 1.5]) await expect(run(jest.fn(), { timeoutMs })).rejects.toThrow('database_read_timeout_invalid');
  controller.abort('PRIVATE');
  await expect(run(jest.fn())).rejects.toMatchObject({ name: 'AbortError', code: 'ABORT_ERR' });
  expect(dependencies.connect).not.toHaveBeenCalled();
});

test.each(['grant', 'failure'])('abort during acquisition promptly rejects and contains late %s', async outcome => {
  const { controller, dependencies, client, run } = setup(), acquisition = deferred(), work = jest.fn();
  dependencies.connect.mockReturnValue(acquisition.promise);
  const pending = run(work);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  if (outcome === 'grant') acquisition.resolve(client); else acquisition.reject(new Error('late failure'));
  await new Promise(resolve => { setImmediate(resolve); });
  expect(work).not.toHaveBeenCalled(); expect(client.query).not.toHaveBeenCalled();
  expect(client.release).toHaveBeenCalledTimes(outcome === 'grant' ? 1 : 0);
});

test('active abort pins target until cancellation settles; blocks late results and later statements', async () => {
  const { controller, dependencies, client, run } = setup(), entered = deferred(), sql = deferred(), cancel = deferred(), cancelling = deferred();
  dependencies.cancelRead.mockImplementation(() => { cancelling.resolve(); return cancel.promise; });
  let facade;
  const pending = run(async db => { facade = db; entered.resolve(); return sql.promise; });
  await entered.promise; controller.abort('PRIVATE'); await cancelling.promise;
  expect(dependencies.cancelRead).toHaveBeenCalledWith(identity);
  expect(client.release).not.toHaveBeenCalled();
  sql.resolve('late result');
  await expect(facade.query('must not start')).rejects.toMatchObject({ name: 'AbortError' });
  cancel.resolve(true);
  await expect(pending).rejects.toMatchObject({ name: 'AbortError', message: 'database read aborted' });
  expect(client.query).not.toHaveBeenCalledWith('COMMIT'); expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
  expect(client.release).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(true);
});

test.each(['BEGIN READ ONLY', 'settings', 'SELECT slow', 'COMMIT'])('abort during %s cannot return success', async stage => {
  const { client, controller, dependencies, run } = setup();
  client.query.mockImplementation(async sql => {
    if (sql === stage || (stage === 'settings' && sql.includes('set_config'))) controller.abort();
    return { rows: [identity] };
  });
  await expect(run(db => db.query('SELECT slow'))).rejects.toMatchObject({ name: 'AbortError' });
  expect(client.release).toHaveBeenCalledWith(true);
  expect(dependencies.cancelRead).toHaveBeenCalledTimes(['SELECT slow', 'COMMIT'].includes(stage) ? 1 : 0);
});

test('internal deadline aborts a stalled callback and contains its later rejection', async () => {
  const { run, client, dependencies } = setup(), stalled = deferred();
  await expect(run(() => stalled.promise, { timeoutMs: 20 })).rejects.toMatchObject({ name: 'AbortError' });
  expect(dependencies.cancelRead).toHaveBeenCalledTimes(1); expect(client.release).toHaveBeenCalledWith(true);
  stalled.reject(new Error('late failure'));
});

test('server cancellation remains AbortError rather than empty successful retrieval', async () => {
  const { run } = setup();
  await expect(run(async () => { throw Object.assign(new Error('statement timeout'), { code: '57014' }); }))
    .rejects.toMatchObject({ name: 'AbortError', code: 'ABORT_ERR' });
});

test('ordinary query, identity and lease failures discard without masking the cause', async () => {
  const { run, client, dependencies } = setup(), failure = new Error('fixture failure');
  await expect(run(async () => { throw failure; })).rejects.toBe(failure);
  expect(client.release).toHaveBeenCalledWith(true); expect(dependencies.cancelRead).not.toHaveBeenCalled();
  client.query.mockResolvedValue({ rows: [] });
  await expect(run(jest.fn())).rejects.toThrow('database_read_identity_unavailable');
  client.query.mockImplementation(async () => { client.emit('error', failure); return { rows: [identity] }; });
  await expect(run(jest.fn())).rejects.toBe(failure);
});

test('database adapter requires explicit read-only cancellation and leaves ordinary writes unchanged', async () => {
  const { client, controller } = setup(), pool = { connect: jest.fn(async () => client), on: jest.fn() };
  const db = createDatabaseModule({ pgModule: { Pool: class { constructor() { return pool; } } },
    loggerFactory: () => ({ warn: jest.fn() }), environment: {} });
  await expect(db.withTransaction(jest.fn(), { signal: controller.signal })).rejects.toThrow('requires_read_only');
  await db.withTransaction(c => c.query('SELECT 1'), { signal: controller.signal, readOnly: true });
  expect(client.query).toHaveBeenCalledWith('BEGIN READ ONLY');
  client.query.mockClear(); await db.withTransaction(c => c.query('UPDATE fixture'));
  expect(client.query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'UPDATE fixture', 'COMMIT']);
});

test('control connection uses the original pool configuration, not later environment changes', async () => {
  const { client, controller } = setup(), environment = { POSTGRES_HOST: 'original-host' };
  let controlConfig;
  const db = createDatabaseModule({ pgModule: {
    Pool: class { constructor() { return { connect: async () => client, on: jest.fn() }; } },
    Client: class extends EventEmitter {
      constructor(config) { super(); controlConfig = config; }
      async connect() {}
      async query() { return { rows: [{ cancelled: true }] }; }
      async end() {}
    },
  }, loggerFactory: () => ({ warn: jest.fn() }), environment });
  environment.POSTGRES_HOST = 'different-host';
  await expect(db.withTransaction(async () => { controller.abort(); }, { signal: controller.signal, readOnly: true }))
    .rejects.toMatchObject({ name: 'AbortError' });
  expect(controlConfig).toMatchObject({ host: 'original-host', pipeline: false, connectionTimeoutMillis: 500,
    statement_timeout: 500, query_timeout: 750 });
});

function controlSetup() {
  const clients = [], logger = { warn: jest.fn() };
  const createClient = jest.fn(() => {
    const client = Object.assign(new EventEmitter(), { connect: jest.fn(async () => {}),
      query: jest.fn(async () => ({ rows: [{ cancelled: true }] })), end: jest.fn(async () => {}) });
    clients.push(client); return client;
  });
  return { clients, logger, createClient, cancel: createDatabaseReadCanceller({ createClient, logger }) };
}

test('control uses parameterized identity, own role/database and closes its connection', async () => {
  const { clients, cancel, logger } = controlSetup();
  expect(await cancel(identity)).toBe(true);
  expect(clients[0].query.mock.calls[0][1]).toEqual([identity.pid, identity.started]);
  expect(clients[0].query.mock.calls[0][0]).toContain('usename = current_user');
  expect(clients[0].query.mock.calls[0][0]).toContain('backend_start = $2::timestamptz');
  expect(clients[0].end).toHaveBeenCalledTimes(1); expect(clients[0].listenerCount('error')).toBe(0);
  expect(logger.warn).not.toHaveBeenCalled();
});

test('control has bounded admission, no queued cancellation, and recovers capacity', async () => {
  const { cancel, createClient, logger } = controlSetup(), connection = deferred();
  createClient.mockImplementation(() => Object.assign(new EventEmitter(), {
    connect: () => connection.promise, query: async () => ({ rows: [] }), end: async () => {},
  }));
  const first = cancel(identity), second = cancel(identity);
  expect(await cancel(identity)).toBe(false); expect(createClient).toHaveBeenCalledTimes(2);
  connection.resolve(); await Promise.all([first, second]);
  expect(await cancel(identity)).toBe(false); expect(createClient).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(identity.started);
});

test('control validates identity and contains transport, factory and close errors', async () => {
  const { cancel, createClient, logger } = controlSetup();
  for (const invalid of [null, {}, { pid: '123', started: 'now' }]) expect(await cancel(invalid)).toBe(false);
  expect(createClient).not.toHaveBeenCalled();
  createClient.mockImplementationOnce(() => { throw new Error('PRIVATE credentials'); });
  expect(await cancel(identity)).toBe(false);
  createClient.mockImplementationOnce(() => Object.assign(new EventEmitter(), {
    connect: async () => { throw new Error('PRIVATE transport'); }, end: async () => { throw new Error('PRIVATE close'); },
  }));
  expect(await cancel(identity)).toBe(false); expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('PRIVATE');
});

test('control hard deadline prevents late-connect cancellation and holds admission until closed', async () => {
  jest.useFakeTimers();
  try {
    const { cancel, createClient } = controlSetup(), connecting = deferred(), closing = deferred(), query = jest.fn();
    createClient.mockImplementation(() => Object.assign(new EventEmitter(), {
      connect: () => connecting.promise, query, end: () => closing.promise,
    }));
    const first = cancel(identity), second = cancel(identity);
    await jest.advanceTimersByTimeAsync(1500);
    expect(await first).toBe(false); expect(await second).toBe(false);
    expect(await cancel(identity)).toBe(false); expect(createClient).toHaveBeenCalledTimes(2);
    connecting.resolve(); closing.resolve(); await jest.advanceTimersByTimeAsync(0);
    expect(query).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
