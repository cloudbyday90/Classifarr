/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { readInventoryBackgroundReadiness } from '../../services/inventoryBackgroundReadiness.mjs';
import { readInventoryRefreshReadiness } from '../../services/inventoryRefreshReadinessReader.mjs';
import { createInventoryRefreshReadinessFailure, createInventoryRefreshReadinessDiagnostics } from '../../services/inventoryRefreshReadinessDiagnostics.mjs';

const rawFailure = code => Object.assign(Error('PRIVATE SQL/path/token'), { code, detail: 'PRIVATE parameters' });
const report = failure => ({ status: 'deferred', reason: 'unavailable', failure });
async function capture(database, read = readInventoryRefreshReadiness) {
  try { await read(database); } catch (error) { return createInventoryRefreshReadinessFailure(error); }
  throw Error('Expected readiness failure');
}
const failingDatabase = code => ({ withTransaction: callback => callback({ query: async () => { throw rawFailure(code); } }) });

test.each([0, 1])('only the opt-in reader attributes a genuine query failure at query %s', async index => {
  const query = jest.fn(async () => {
    if (query.mock.calls.length === index + 1) throw rawFailure('53100');
    return { rows: [{ readiness: 'ready' }] };
  });
  const failure = await capture({ withTransaction: callback => callback({ query }) });
  expect(failure).toEqual({ incidentId: expect.any(String), stage: 'readiness', category: 'database_disk_full',
    sqlState: '53100', databaseDurationMs: expect.any(Number) });
  expect(Object.isFrozen(failure)).toBe(true);
  expect(query.mock.calls[0][0]).toBe("SET LOCAL statement_timeout='3s'");
  expect(await capture(failingDatabase('53100'), readInventoryBackgroundReadiness)).toMatchObject({ category: 'unknown' });
});

test.each([
  ['57014', 'database_query_cancelled'], ['42501', 'database_permission'], ['53300', 'database_capacity'],
  ['53200', 'database_unknown'], ['53400', 'database_unknown'], ['PRIVATE unknown code', 'database_unknown'],
])('observed SQLSTATE %s retains its own category without becoming disk-full', async (code, category) => {
  const failure = await capture(failingDatabase(code));
  expect(failure.category).toBe(category);
  if (category === 'database_unknown') expect(failure).not.toHaveProperty('sqlState');
  else expect(failure.sqlState).toBe(code);
  expect(JSON.stringify(failure)).not.toMatch(/PRIVATE|SQL\/path|parameters|detail/);
});

test.each(['before callback entry', 'after callback completion'])('trusted transaction failures %s remain attributable', async phase => {
  const database = { withTransaction: async callback => {
    if (phase === 'before callback entry') throw rawFailure('53100');
    await callback({ query: async () => ({ rows: [{ readiness: 'ready' }] }) });
    throw rawFailure('53100');
  } };
  expect(await capture(database)).toMatchObject({ category: 'database_disk_full', sqlState: '53100' });
});

test('an application projection failure inside an unfinished transaction is not database proof', async () => {
  const database = { withTransaction: callback => callback({ query: async () => ({ get rows() { throw rawFailure('53100'); } }) }) };
  expect(await capture(database)).toMatchObject({ category: 'unknown' });
});

test('unobserved codes, causes, raw text, primitives and hostile getters cannot claim database origin', async () => {
  const getter = jest.fn(() => { throw rawFailure('53100'); });
  for (const error of [rawFailure('53100'), { cause: rawFailure('53100') }, 'No space left on device', null,
    Object.defineProperty({}, 'code', { get: getter }), new Proxy({}, { getOwnPropertyDescriptor: getter })]) {
    const failure = createInventoryRefreshReadinessFailure(error);
    expect(failure).toEqual({ incidentId: expect.any(String), stage: 'readiness', category: 'unknown' });
  }
  const failure = await capture({ withTransaction: callback => callback({ query: async () => {
    throw Object.defineProperty({}, 'code', { get: getter });
  } }) });
  expect(failure).toMatchObject({ category: 'database_unknown' });
  expect(getter).not.toHaveBeenCalled();
});

test('warnings require minted capsules and fixed deferred state; storage guidance makes no new retry claim', async () => {
  const failure = await capture(failingDatabase('53100'));
  const log = { warn: jest.fn() }, diagnostics = createInventoryRefreshReadinessDiagnostics({ log, now: () => 0 });
  for (const value of [{ ...failure }, { ...failure, category: 'PRIVATE' }, null]) diagnostics.report(report(value));
  diagnostics.report({ status: 'failed', reason: 'unavailable', failure });
  diagnostics.report({ status: 'deferred', reason: 'disabled', failure });
  diagnostics.report(new Proxy({}, { getOwnPropertyDescriptor() { throw Error('PRIVATE getter'); } }));
  expect(log.warn).not.toHaveBeenCalled();
  diagnostics.report(report(failure));
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('heavy work remains deferred'), {
    failure, problem: expect.stringContaining('reported insufficient storage'),
    steps: expect.stringContaining('Preserve backups'), routingAffected: false,
  }, { persistStack: false });
  const serialized = JSON.stringify(log.warn.mock.calls);
  expect(serialized).toContain('existing schedule');
  expect(serialized).not.toMatch(/PRIVATE|one hour|3600|slowRetry|retryAfter|recovered automatically/);
});

test('exact thirty-minute bounds survive category changes, successful probes, clock reversal and restart', async () => {
  const disk = report(await capture(failingDatabase('53100'))), permission = report(await capture(failingDatabase('42501')));
  let time = 0;
  const log = { warn: jest.fn() }, diagnostics = createInventoryRefreshReadinessDiagnostics({ log, now: () => time });
  diagnostics.report(disk); diagnostics.report(permission);
  time = 1_799_999;
  diagnostics.report({ status: 'ready' }); diagnostics.report(disk); diagnostics.report(permission);
  expect(log.warn).toHaveBeenCalledTimes(2);
  time++; diagnostics.report(disk); diagnostics.report(permission);
  expect(log.warn).toHaveBeenCalledTimes(4);
  time = 1; diagnostics.report(disk);
  expect(log.warn).toHaveBeenCalledTimes(4);
  createInventoryRefreshReadinessDiagnostics({ log, now: () => time }).report(disk);
  expect(log.warn).toHaveBeenCalledTimes(5);
});

test('invalid clocks suppress warnings without throwing or coercing values', () => {
  let time;
  const log = { warn: jest.fn() }, diagnostics = createInventoryRefreshReadinessDiagnostics({ log, now: () => {
    if (time === 'throw') throw Error('PRIVATE clock');
    return time;
  } });
  const value = report(createInventoryRefreshReadinessFailure(rawFailure('53100')));
  for (time of [NaN, Infinity, -1, '0', { valueOf() { throw Error('PRIVATE coercion'); } }, 'throw']) diagnostics.report(value);
  expect(log.warn).not.toHaveBeenCalled();
  time = 0; diagnostics.report(value);
  expect(log.warn).toHaveBeenCalledTimes(1);
  expect(log.warn.mock.calls[0][1]).toMatchObject({ failure: { category: 'unknown' },
    problem: expect.stringContaining('without a trusted database diagnosis') });
});

test.each(['throw', 'reject'])('logger %s failure preserves warning bounds and cannot escape', async mode => {
  let time = 0;
  const log = { warn: jest.fn(() => {
    if (mode === 'throw') throw Error('PRIVATE logger');
    return Promise.reject(Error('PRIVATE logger'));
  }) };
  const diagnostics = createInventoryRefreshReadinessDiagnostics({ log, now: () => time });
  const value = report(await capture(failingDatabase('53100')));
  expect(() => diagnostics.report(value)).not.toThrow();
  diagnostics.report(value); expect(log.warn).toHaveBeenCalledTimes(1);
  time = 1_800_000; diagnostics.report(value); await Promise.resolve();
  expect(log.warn).toHaveBeenCalledTimes(2);
});
