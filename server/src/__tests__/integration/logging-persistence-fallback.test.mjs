/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { getPool } from './setup.mjs';
import { LoggerShim, persistToDb, setDb } from '../../utils/logging/loggerShim.mjs';
import { resetDedupeState } from '../../utils/logging/dedupe.mjs';
import { createConsoleSpy } from '../setup/consoleHelpers.mjs';

test('real PostgreSQL INSERT refusal, rollback and successful persistence preserve the shared fallback bound', async () => {
  const output = createConsoleSpy('error', { suppress: true });
  const pino = { bindings: () => ({ module: 'LogFallbackFixture' }), error: jest.fn(), warn: jest.fn() };
  const logger = new LoggerShim(pino), codes = [], ids = [];
  let client;
  try {
    for (let pass = 0; pass < 2; pass++) {
      client = await getPool().connect();
      await client.query('BEGIN READ ONLY');
      const query = jest.fn(async (...args) => {
        try { return await client.query(...args); }
        catch (error) { codes.push(error.code); throw error; }
      });
      setDb({ query });
      if (pass === 0) {
        await expect(logger.error('Synthetic refusal', { password: 'PRIVATE password' })).resolves.toBeNull();
        await expect(logger.warn('Synthetic aborted transaction', { token: 'PRIVATE token' })).resolves.toBeNull();
        expect(query).toHaveBeenCalledTimes(2);
      } else {
        await expect(persistToDb('ERROR', 'Direct', 'Second refusal', {})).resolves.toBeNull();
        expect(query).toHaveBeenCalledTimes(1);
      }
      expect(codes.at(-1)).toBe(pass === 0 ? '25P02' : '25006');
      await client.query('ROLLBACK');
      expect((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only).toBe('off');
      client.release(); client = null;
      setDb(null); resetDedupeState(); setDb(getPool());
      const id = await persistToDb('WARN', 'LogFallbackFixture', 'Synthetic successful persistence', {
        password: 'PRIVATE successful payload', safe: 'retained',
      }, { persistStack: false });
      expect(id).toEqual(expect.any(String)); ids.push(id);
      const row = (await getPool().query('SELECT metadata,stack_trace FROM error_log WHERE error_id=$1', [id])).rows[0];
      expect(row).toEqual({ metadata: { password: '[REDACTED]', safe: 'retained' }, stack_trace: null });
    }
    expect(codes).toEqual(['25006', '25P02', '25006']);
    expect(pino.error).toHaveBeenCalledWith({ password: '[REDACTED]' }, 'Synthetic refusal');
    expect(pino.warn).toHaveBeenCalledWith({ token: '[REDACTED]' }, 'Synthetic aborted transaction');
    expect(output.spy.mock.calls).toEqual([['Classifarr log persistence unavailable; check logging and database health.']]);
    expect(JSON.stringify(output.spy.mock.calls)).not.toMatch(/PRIVATE|25006|25P02|INSERT|LogFallbackFixture/);
    expect((await getPool().query('SELECT 1 AS healthy')).rows[0].healthy).toBe(1);
  } finally {
    setDb(null);
    try {
      if (client) { try { await client.query('ROLLBACK'); } finally { client.release(); } }
      if (ids.length) await getPool().query('DELETE FROM error_log WHERE error_id=ANY($1::uuid[])', [ids]);
    } finally { output.restore(); }
  }
});
