/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { createDatabaseReadinessAdmission, isDatabaseReadinessAdmissionDeferred, READINESS_SCOPES } from '../utils/databaseReadinessAdmission.mjs';
import { createDatabaseModule } from '../config/database.mjs';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => { setImmediate(resolve); });
const scope = READINESS_SCOPES.DESCRIPTION;

test.each(['grant', 'reject'])('scope stays occupied after the caller settles until actual acquisition %s', async outcome => {
  const gate = createDatabaseReadinessAdmission(), acquisition = deferred(), connect = jest.fn(() => acquisition.promise);
  const abandoned = Error('synthetic cancellation');
  const run = gate.run(scope, connect, acquire => { acquire().catch(() => {}); throw abandoned; }); // swallow-error: Own the deliberately detached fixture rejection while asserting the gate remains charged through drain.
  await expect(run).rejects.toBe(abandoned);
  const operation = jest.fn();
  for (let index = 0; index < 20; index++) {
    try { await gate.run(scope, connect, operation); throw Error('must defer'); }
    catch (error) { expect(isDatabaseReadinessAdmissionDeferred(error)).toBe(true); }
  }
  expect(connect).toHaveBeenCalledTimes(1); expect(operation).not.toHaveBeenCalled();
  expect(await gate.run(READINESS_SCOPES.REPRESENTATIVE, async () => 7, acquire => acquire())).toBe(7);
  if (outcome === 'grant') acquisition.resolve({}); else acquisition.reject(Error('PRIVATE late rejection'));
  await flush();
  expect(await gate.run(scope, async () => 9, acquire => acquire())).toBe(9);
});

test('completed acquisition does not release admission before read cleanup settles', async () => {
  const gate = createDatabaseReadinessAdmission(), cleanup = deferred(), entered = deferred();
  const pending = gate.run(scope, async () => 1, async acquire => { await acquire(); entered.resolve(); await cleanup.promise; return 7; });
  await entered.promise;
  const rejected = await gate.run(scope, jest.fn(), jest.fn()).catch(error => error);
  expect(isDatabaseReadinessAdmissionDeferred(rejected)).toBe(true);
  cleanup.resolve(); expect(await pending).toBe(7);
  expect(await gate.run(scope, async () => 1, acquire => acquire())).toBe(1);
});

test('invalid scope, sync failures, repeated and retained acquisitions cannot leak a slot', async () => {
  const gate = createDatabaseReadinessAdmission(), connect = jest.fn();
  for (const invalid of [undefined, null, 'unknown', {}, '__proto__']) {
    await expect(gate.run(invalid, connect, jest.fn())).rejects.toThrow('scope_invalid');
  }
  expect(connect).not.toHaveBeenCalled();
  await expect(gate.run(scope, () => { throw Error('connect failure'); }, acquire => acquire())).rejects.toThrow('connect failure');
  let retained;
  await gate.run(scope, async () => 1, async acquire => { retained = acquire; await acquire(); expect(() => acquire()).toThrow('acquisition_closed'); });
  expect(() => retained()).toThrow('acquisition_closed');
  expect(await gate.run(scope, connect, async () => 4)).toBe(4);
  expect(isDatabaseReadinessAdmissionDeferred({ message: 'database_readiness_scope_occupied' })).toBe(false);
});

test('database option rejects unsigned/write/unknown scopes before acquiring and preserves default transactions', async () => {
  const pool = { connect: jest.fn(), on: jest.fn() };
  const db = createDatabaseModule({ pgModule: { Pool: class { constructor() { return pool; } } }, loggerFactory: () => ({}), environment: {} });
  for (const options of [{ readinessScope: scope }, { readinessScope: scope, readOnly: true }, { readinessScope: scope, signal: new AbortController().signal }]) {
    await expect(db.withTransaction(jest.fn(), options)).rejects.toThrow('signaled_read_only');
  }
  await expect(db.withTransaction(jest.fn(), { readinessScope: 'unknown', signal: new AbortController().signal, readOnly: true })).rejects.toThrow('scope_invalid');
  const controller = new AbortController(); controller.abort();
  await expect(db.withTransaction(jest.fn(), { readinessScope: scope, signal: controller.signal, readOnly: true })).rejects.toMatchObject({ name: 'AbortError' });
  expect(pool.connect).not.toHaveBeenCalled();
});
