/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { LoggerShim, persistToDb, setDb } from '../../utils/logging/loggerShim.mjs';
import { resetDedupeState } from '../../utils/logging/dedupe.mjs';

afterEach(() => { setDb(null); resetDedupeState(); });

function fixture() {
  const primary = { bindings: () => ({ module: 'Projection' }) };
  for (const level of ['error', 'warn', 'info', 'debug']) primary[level] = jest.fn();
  const db = { query: jest.fn().mockResolvedValue({ rows: [{ error_id: 'saved' }] }) };
  setDb(db);
  return { primary, db, logger: new LoggerShim(primary) };
}

test.each(['error', 'warn', 'info', 'debug'])('%s retains the event and safe siblings for cyclic/accessor data', async level => {
  const { primary, db, logger } = fixture();
  const getter = jest.fn(() => { throw Error('PRIVATE getter'); });
  const input = { safe: 'retained', password: 'PRIVATE password' };
  input.self = input;
  Object.defineProperty(input, 'error', { enumerable: true, get: getter });
  await logger[level]('Original event', input);
  expect(getter).not.toHaveBeenCalled();
  const projection = primary[level].mock.calls[0][0];
  expect(projection).toEqual({ safe: 'retained', password: '[REDACTED]', self: '[LogData:cycle]', error: '[LogData:accessor]' });
  expect(primary[level]).toHaveBeenCalledWith(projection, 'Original event');
  if (['error', 'warn'].includes(level)) {
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[0][1][6]).toBe(projection);
  } else expect(db.query).not.toHaveBeenCalled();
});

test('direct persistence always projects data; extra public arguments cannot bypass it', async () => {
  const { db } = fixture();
  const input = { safe: 1 }; input.cycle = input;
  await expect(persistToDb('WARN', 'Direct', 'Original event', input, { persistStack: false }, { data: { unsafe: input } })).resolves.toBe('saved');
  expect(db.query.mock.calls[0][1]).toEqual(['WARN', 'Direct', 'Original event', null, null, expect.any(Object), { safe: 1, cycle: '[LogData:cycle]' }]);
});

test('deduped warnings never inspect data, while skipped persistence still emits projected data', async () => {
  const { primary, db, logger } = fixture();
  const options = { dedupeKey: 'same', dedupeWindowMs: 60000 };
  await logger.warn('Same event', { safe: 1 }, options);
  const hostile = Proxy.revocable({}, {}); hostile.revoke();
  expect(await logger.warn('Same event', hostile.proxy, options)).toBeNull();
  expect(primary.warn).toHaveBeenCalledTimes(1);
  expect(db.query).toHaveBeenCalledTimes(1);
  await logger.error('No database', { token: 'PRIVATE' }, { skipDbPersist: true });
  expect(primary.error).toHaveBeenCalledWith({ token: '[REDACTED]' }, 'No database');
  expect(db.query).toHaveBeenCalledTimes(1);
});

test('primary transport failures retain their existing boundary and make no INSERT', async () => {
  const { primary, db, logger } = fixture();
  for (const level of ['error', 'warn', 'info', 'debug']) primary[level].mockImplementation(() => { throw Error('Synthetic transport failure'); });
  await expect(logger.error('Event', {})).rejects.toThrow('Synthetic transport failure');
  await expect(logger.warn('Event', {})).rejects.toThrow('Synthetic transport failure');
  expect(() => logger.info('Event', {})).toThrow('Synthetic transport failure');
  expect(() => logger.debug('Event', {})).toThrow('Synthetic transport failure');
  expect(db.query).not.toHaveBeenCalled();
});

test('native stack materialization stays separate from data projection and error selection', async () => {
  const { primary, db, logger } = fixture();
  const prepare = Error.prepareStackTrace;
  const hook = jest.fn(() => 'Original native stack');
  try {
    Error.prepareStackTrace = hook;
    const error = new Error('PRIVATE native message');
    await logger.error('No persisted stack', { error, safe: 1 }, { persistStack: false });
    expect(primary.error.mock.calls[0][0]).toEqual({ error: '[LogData:unsupported]', safe: 1 });
    expect(hook).not.toHaveBeenCalled();
    expect(db.query.mock.calls[0][1][3]).toBeNull();
    await logger.warn('Persist original stack', { error });
    expect(hook).toHaveBeenCalledTimes(1);
    expect(db.query.mock.calls[1][1][3]).toBe('Original native stack');
  } finally { Error.prepareStackTrace = prepare; }
});

test('absent/null data retains empty primary objects and original metadata absence', async () => {
  const { primary, db, logger } = fixture();
  await logger.error('Absent');
  await logger.error('Null', null);
  expect(primary.error.mock.calls.map(args => args[0])).toEqual([{}, {}]);
  expect(db.query.mock.calls.map(args => args[1][6])).toEqual([undefined, null]);
});
