/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { afterEach, expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { LoggerShim, persistToDb, setDb } from '../../utils/logging/loggerShim.mjs';
import { resetDedupeState } from '../../utils/logging/dedupe.mjs';
import { createConsoleSpy } from '../setup/consoleHelpers.mjs';

afterEach(() => { setDb(null); resetDedupeState(); });

test('hostile cyclic data persists as bounded JSONB with matching primary metadata and original stack', async () => {
  const primary = { bindings: () => ({ module: 'ProjectionFixture' }), error: jest.fn() };
  const logger = new LoggerShim(primary);
  const getter = jest.fn(() => { throw Error('PRIVATE getter'); });
  const input = JSON.parse('{"__proto__":null,"safe":"retained","password":"PRIVATE password"}');
  input.level = 0;
  input.cycle = input;
  input.large = Array(64).fill('"\\\n'.repeat(4096));
  input.err = new Error('Original classification boundary');
  Object.defineProperty(input, 'error', { enumerable: true, get: getter });
  setDb(getPool());
  const id = await logger.error('Synthetic hostile metadata', input);
  expect(id).toEqual(expect.any(String));
  try {
    const row = (await getPool().query('SELECT level,module,message,stack_trace,metadata,octet_length(metadata::text) AS bytes FROM error_log WHERE error_id=$1', [id])).rows[0];
    expect(row).toMatchObject({ level: 'ERROR', module: 'ProjectionFixture', message: 'Synthetic hostile metadata', stack_trace: input.err.stack });
    expect(row.metadata).toEqual(JSON.parse(JSON.stringify(primary.error.mock.calls[0][0])));
    expect(row.metadata.logData).toMatchObject({ safe: 'retained', password: '[REDACTED]', cycle: '[LogData:cycle]', error: '[LogData:accessor]' });
    expect(Object.hasOwn(row.metadata.logData, '__proto__')).toBe(true);
    expect(row.metadata.logData.__proto__).toBeNull();
    // The contract uses compact JSON; PostgreSQL JSONB text adds formatting spaces.
    expect(Buffer.byteLength(JSON.stringify(row.metadata))).toBeLessThanOrEqual(65536);
    expect(row.bytes).toBeLessThan(67000);
    expect(JSON.stringify(row.metadata)).not.toContain('PRIVATE');
    expect(getter).not.toHaveBeenCalled();
    expect((await getPool().query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
  } finally { await getPool().query('DELETE FROM error_log WHERE error_id=$1', [id]); }
});

test('direct projection preserves a hydrated upstream stack without reading error selectors', async () => {
  const getter = jest.fn(() => { throw Error('PRIVATE selector'); });
  const plain = { name: 'TypeError', message: 'Original', stack: 'TypeError: Original\n at originalBoundary' };
  const input = { error: plain, api_key: 'PRIVATE key', safe: false };
  const options = Object.defineProperty({}, 'error', { get: getter });
  setDb(getPool());
  const id = await persistToDb('WARN', 'ProjectionFixture', 'Synthetic hydrated metadata', input, options);
  expect(id).toEqual(expect.any(String));
  try {
    const row = (await getPool().query('SELECT stack_trace,metadata FROM error_log WHERE error_id=$1', [id])).rows[0];
    expect(row).toEqual({ stack_trace: plain.stack, metadata: { error: plain, api_key: '[REDACTED]', safe: false } });
    expect(getter).not.toHaveBeenCalled();
  } finally { await getPool().query('DELETE FROM error_log WHERE error_id=$1', [id]); }
});

test('read-only INSERT refusal still returns null, then rollback allows safe persistence and pool reuse', async () => {
  const output = createConsoleSpy('error', { suppress: true });
  let client, id;
  try {
    client = await getPool().connect();
    await client.query('BEGIN READ ONLY');
    const codes = [];
    const query = jest.fn(async (...args) => {
      try { return await client.query(...args); }
      catch (error) { codes.push(error.code); throw error; }
    });
    setDb({ query });
    const data = { safe: 1 }; data.cycle = data;
    await expect(persistToDb('WARN', 'ProjectionFixture', 'Synthetic refused metadata', data)).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
    expect(codes).toEqual(['25006']);
    await client.query('ROLLBACK');
    expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('off');
    client.release(); client = null;
    setDb(getPool());
    id = await persistToDb('WARN', 'ProjectionFixture', 'Synthetic successful metadata', data);
    expect(id).toEqual(expect.any(String));
    const row = (await getPool().query('SELECT metadata FROM error_log WHERE error_id=$1', [id])).rows[0];
    expect(row.metadata).toEqual({ safe: 1, cycle: '[LogData:cycle]' });
    expect(output.spy.mock.calls).toEqual([['Classifarr log persistence unavailable; check logging and database health.']]);
    expect((await getPool().query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
  } finally {
    try {
      if (client) { try { await client.query('ROLLBACK'); } finally { client.release(); } }
      if (id) await getPool().query('DELETE FROM error_log WHERE error_id=$1', [id]);
    } finally { output.restore(); }
  }
});

test('PostgreSQL-specific Unicode refusals retain the existing null result and do not poison the pool', async () => {
  const codes = [];
  setDb({ query: async (...args) => {
    try { return await getPool().query(...args); }
    catch (error) { codes.push(error.code); throw error; }
  } });
  for (const text of ['\u0000', '\ud800']) {
    await expect(persistToDb('WARN', 'ProjectionFixture', 'Synthetic Unicode refusal', { text })).resolves.toBeNull();
  }
  expect(codes).toEqual(['22P05', '22P02']);
  expect((await getPool().query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
});
