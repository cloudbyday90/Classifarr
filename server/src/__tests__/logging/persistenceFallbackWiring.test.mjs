/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { expect, jest, test } from '@jest/globals';
import { LoggerShim, persistToDb, setDb } from '../../utils/logging/loggerShim.mjs';
import { resetDedupeState } from '../../utils/logging/dedupe.mjs';
import { createConsoleSpy } from '../setup/consoleHelpers.mjs';

test('one shared fixed fallback preserves null results without inspecting failures or resetting after writes', async () => {
  const output = createConsoleSpy('error', { suppress: true });
  output.spy.mockImplementationOnce(() => { throw Error('PRIVATE output failure'); });
  const pino = module => ({ bindings: () => ({ module }), error: jest.fn(), warn: jest.fn() });
  const firstPrimary = pino('First'), secondPrimary = pino('PRIVATE module');
  const first = new LoggerShim(firstPrimary), second = new LoggerShim(secondPrimary);
  const caughtMessage = jest.fn(() => { throw Error('PRIVATE getter must not run'); });
  const pending = [];
  const failing = { query: jest.fn(() => new Promise((_resolve, reject) => { pending.push(reject); })) };
  try {
    setDb(null);
    await expect(first.error('Original primary event', { password: 'PRIVATE credential' })).resolves.toBeNull();
    expect(firstPrimary.error).toHaveBeenCalledWith({ password: '[REDACTED]' }, 'Original primary event');
    expect(output.spy).not.toHaveBeenCalled();
    setDb(failing);
    const settled = Promise.allSettled([
      first.error('First event'), second.warn('Second event'), persistToDb('ERROR', 'Direct', 'Third event', {}),
    ]);
    expect(failing.query).toHaveBeenCalledTimes(3);
    // Complete in a different order from invocation; these share one fallback interval.
    pending[2](Object.defineProperty({}, 'message', { get: caughtMessage }));
    pending[1](null);
    pending[0](Error('PRIVATE SQL/path/token\nFORGED LOG'));
    expect(await settled).toEqual(Array.from({ length: 3 }, () => ({ status: 'fulfilled', value: null })));
    expect(caughtMessage).not.toHaveBeenCalled();
    expect(output.spy.mock.calls).toEqual([['Classifarr log persistence unavailable; check logging and database health.']]);
    expect(firstPrimary.error).toHaveBeenCalledTimes(2); expect(secondPrimary.warn).toHaveBeenCalledTimes(1);

    const replacement = { query: jest.fn().mockResolvedValueOnce({ rows: [{ error_id: 'successful-id' }] }) };
    setDb(replacement);
    await expect(persistToDb('WARN', 'Direct', 'Successful event', {})).resolves.toBe('successful-id');
    replacement.query.mockRejectedValue(undefined);
    resetDedupeState();
    await expect(second.error('Later event')).resolves.toBeNull();
    await expect(persistToDb('ERROR', 'Direct', 'Later direct event', {})).resolves.toBeNull();
    expect(replacement.query).toHaveBeenCalledTimes(3);
    setDb(null);
    await expect(persistToDb('ERROR', 'Direct', 'No database', {})).resolves.toBeNull();
    setDb(replacement);
    const preparation = { get error() { throw Object.defineProperty({}, 'message', { get: caughtMessage }); } };
    await expect(persistToDb('ERROR', 'Direct', 'Preparation failure', {}, preparation)).resolves.toBeNull();
    expect(replacement.query).toHaveBeenCalledTimes(3);
    replacement.query.mockResolvedValueOnce({ rows: [] });
    await expect(persistToDb('WARN', 'Direct', 'Malformed result', {})).resolves.toBeNull();
    expect(replacement.query).toHaveBeenCalledTimes(4);
    expect(caughtMessage).not.toHaveBeenCalled();
    expect(output.spy).toHaveBeenCalledTimes(1);

    const queries = replacement.query.mock.calls.length;
    await first.error('Skip persistence', {}, { skipDbPersist: true });
    expect(replacement.query).toHaveBeenCalledTimes(queries);
    // Primary-output failures retain their existing boundary outside persistence handling.
    firstPrimary.error.mockImplementationOnce(() => { throw Error('primary output failure'); });
    await expect(first.error('Primary failure')).rejects.toThrow('primary output failure');
    expect(replacement.query).toHaveBeenCalledTimes(queries);
  } finally { setDb(null); output.restore(); }
});
