/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { withInventoryRefreshReadiness } from '../../services/inventoryRefreshReadinessGuard.mjs';
import { readInventoryRefreshReadiness } from '../../services/inventoryRefreshReadinessReader.mjs';
import { createDatabaseReadinessAdmission, READINESS_SCOPES } from '../../utils/databaseReadinessAdmission.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const scope = READINESS_SCOPES.DESCRIPTION;
afterEach(() => jest.useRealTimers());
function setup(read) {
  const worker = { run: jest.fn(async () => ({ status: 'done' })), stop: jest.fn() };
  return { worker, guard: withInventoryRefreshReadiness(worker, {}, scope, read) };
}

test('one coalesced flight keeps first-owner arguments and later caller cannot abort it', async () => {
  const ready = deferred(), owner = new AbortController(), joiner = new AbortController();
  const read = jest.fn(() => ready.promise), { worker, guard } = setup(read);
  const args = { signal: owner.signal, safe: 1 };
  const first = guard.run(args);
  expect(guard.run({ signal: joiner.signal })).toBe(first);
  joiner.abort('PRIVATE joiner');
  expect(await guard.run({ signal: joiner.signal })).toEqual({ status: 'cancelled' });
  expect(read.mock.calls[0][1].signal.aborted).toBe(false);
  ready.resolve('ready'); expect(await first).toEqual({ status: 'done' });
  expect(worker.run).toHaveBeenCalledTimes(1); expect(worker.run).toHaveBeenCalledWith(args);
  guard.stop();
});

test.each(['stop', 'owner'])('%s aborts probe and fences even an adapter returning a late ready result', async cause => {
  const ready = deferred(), owner = new AbortController();
  let observed;
  const { worker, guard } = setup((_db, options) => { observed = options.signal; return ready.promise; });
  const first = guard.run({ signal: owner.signal });
  if (cause === 'stop') guard.stop(); else owner.abort('PRIVATE owner');
  expect(observed.aborted).toBe(true);
  ready.resolve('ready');
  expect(await first).toEqual({ status: cause === 'stop' ? 'stopped' : 'cancelled' });
  expect(worker.run).not.toHaveBeenCalled();
  guard.stop(); expect(await guard.run()).toEqual({ status: 'stopped' });
});

test('three-second deadline is exact, late rejection is quiet and the next tick runs fresh', async () => {
  jest.useFakeTimers();
  const blocked = deferred(); let signal;
  const read = jest.fn((_db, options) => { signal = options.signal; return blocked.promise; });
  const { worker, guard } = setup(read), pending = guard.run();
  await jest.advanceTimersByTimeAsync(2999); expect(signal.aborted).toBe(false);
  await jest.advanceTimersByTimeAsync(1); expect(signal.aborted).toBe(true);
  blocked.reject(Object.assign(Error('PRIVATE late database error'), { code: '53100' }));
  expect(await pending).toEqual({ status: 'deferred', reason: 'unavailable' });
  expect(worker.run).not.toHaveBeenCalled();
  read.mockResolvedValueOnce('ready'); expect(await guard.run()).toEqual({ status: 'done' });
  guard.stop(); expect(jest.getTimerCount()).toBe(0);
});

test('probe timer is cleared before heavy work and cannot shorten its execution', async () => {
  jest.useFakeTimers();
  const heavy = deferred(), { worker, guard } = setup(async () => 'ready');
  worker.run.mockReturnValue(heavy.promise);
  const pending = guard.run(); await jest.advanceTimersByTimeAsync(0);
  expect(worker.run).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(5000);
  heavy.resolve({ status: 'done' }); expect(await pending).toEqual({ status: 'done' }); guard.stop();
});

test('occupied database scope defers without a diagnostic or another acquisition', async () => {
  const admission = createDatabaseReadinessAdmission(), drain = deferred();
  const held = admission.run(scope, jest.fn(), () => drain.promise);
  const { worker, guard } = setup(() => admission.run(scope, jest.fn(), jest.fn()));
  expect(await guard.run()).toEqual({ status: 'deferred', reason: 'unavailable' });
  expect(worker.run).not.toHaveBeenCalled(); drain.resolve(); await held; guard.stop();
});

test('native query evidence survives shared 57014 replacement, including cleanup after the local deadline', async () => {
  jest.useFakeTimers();
  const sql = Object.assign(Error('PRIVATE SQL'), { code: '57014' }), cleanup = deferred(), seen = deferred();
  const database = { withTransaction: async callback => {
    try { return await callback({ query: async () => { throw sql; } }); }
    catch { seen.resolve(); await cleanup.promise; throw Object.assign(Error('generic'), { name: 'AbortError', code: 'ABORT_ERR' }); }
  } };
  const worker = { run: jest.fn(), stop: jest.fn() }, guard = withInventoryRefreshReadiness(worker, database, scope);
  const pending = guard.run(); await seen.promise; await jest.advanceTimersByTimeAsync(3000); cleanup.resolve();
  expect(await pending).toMatchObject({ status: 'deferred', reason: 'unavailable', failure: { category: 'database_query_cancelled', sqlState: '57014' } });
  expect(worker.run).not.toHaveBeenCalled(); guard.stop();
});

test('application projection errors cannot become SQL evidence; stopped native failures stay quiet', async () => {
  const fake = Object.assign(Error('PRIVATE projection'), { code: '53100' });
  const database = { withTransaction: callback => callback({ query: async () => ({ get rows() { throw fake; } }) }) };
  const worker = { run: jest.fn(), stop: jest.fn() }, guard = withInventoryRefreshReadiness(worker, database, scope);
  expect(await guard.run()).toMatchObject({ status: 'deferred', failure: { category: 'unknown' } });
  const blocked = deferred(), stopped = setup(() => blocked.promise), pending = stopped.guard.run();
  stopped.guard.stop(); blocked.reject(fake);
  expect(await pending).toEqual({ status: 'stopped' }); guard.stop();
  expect(() => withInventoryRefreshReadiness(worker, database, 'unknown')).toThrow('scope_invalid');
  // Legacy reader remains unchanged for non-opted-in call sites.
  const query = jest.fn(async () => ({ rows: [{ readiness: 'disabled' }] }));
  expect(await readInventoryRefreshReadiness({ withTransaction: callback => callback({ query }) })).toBe('disabled');
  expect(query.mock.calls[0][0]).toBe("SET LOCAL statement_timeout='3s'");
});

test('reusing an exception cannot transfer live evidence to a later expired probe', async () => {
  jest.useFakeTimers();
  const sql = Object.assign(Error('PRIVATE SQL'), { code: '53100' }), late = deferred();
  let first = true;
  const database = { withTransaction: callback => callback({ query: () => {
    if (first) { first = false; throw sql; }
    return late.promise;
  } }) };
  const worker = { run: jest.fn(), stop: jest.fn() }, guard = withInventoryRefreshReadiness(worker, database, scope);
  expect(await guard.run()).toMatchObject({ failure: { category: 'database_disk_full' } });
  const pending = guard.run(); await jest.advanceTimersByTimeAsync(3000); late.reject(sql);
  expect(await pending).toEqual({ status: 'deferred', reason: 'unavailable' }); guard.stop();
});
