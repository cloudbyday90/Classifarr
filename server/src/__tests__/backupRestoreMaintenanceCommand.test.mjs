/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { Readable } from 'node:stream';
import { runRestoreMaintenanceCommand } from '../scripts/runDatabaseRestoreMaintenance.mjs';

test.each([[[], 0], [['--help'], 0], [['--apply', '--force'], 2], [['secret'], 2]])('args %j never read input or connect', async (args, code) => {
  const readInput = jest.fn(), loadDatabase = jest.fn(), output = jest.fn();
  expect(await runRestoreMaintenanceCommand({ args, readInput, loadDatabase, output })).toBe(code);
  expect(readInput).not.toHaveBeenCalled();
  expect(loadDatabase).not.toHaveBeenCalled();
  expect(JSON.stringify(output.mock.calls)).not.toContain('secret');
});

test('bad input never loads the database or maintenance module', async () => {
  const loadDatabase = jest.fn(), loadMaintenance = jest.fn(), output = jest.fn();
  expect(await runRestoreMaintenanceCommand({ args: ['--apply'], input: Readable.from(['secret']), loadDatabase, loadMaintenance, output })).toBe(2);
  expect(loadDatabase).not.toHaveBeenCalled();
  expect(loadMaintenance).not.toHaveBeenCalled();
  expect(output).toHaveBeenCalledWith('{"status":"rejected","reason":"invalid_restore_request"}');
});

test.each(['complete', 'busy', 'failed', 'load-failed', 'cleanup-failed'])('%s closes its pool and exposes only the sanitized final result', async scenario => {
  const request = { backupData: { version: '2.0', data: {} }, mode: 'merge' };
  const database = { pool: { end: jest.fn(async () => { if (scenario === 'cleanup-failed') throw new Error('private'); }) } };
  const run = jest.fn(async () => {
    if (scenario === 'busy' || scenario === 'failed') throw Object.assign(new Error('private'), { code: scenario === 'busy' ? 'RESTORE_RUNTIME_BUSY' : 'XX000' });
    return { status: 'complete', newApiKey: 'private', backup: 'private' };
  });
  const output = jest.fn();
  const code = await runRestoreMaintenanceCommand({ args: ['--apply'], readInput: async () => request,
    loadDatabase: async () => { if (scenario === 'load-failed') throw new Error('private'); return database; },
    loadMaintenance: async () => ({ runBackupRestoreMaintenance: run }), output });
  expect(code).toBe(scenario === 'complete' ? 0 : scenario === 'busy' ? 75 : 1);
  expect(database.pool.end).toHaveBeenCalledTimes(scenario === 'load-failed' ? 0 : 1);
  expect(output).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(output.mock.calls)).not.toContain('private');
  if (scenario === 'cleanup-failed') expect(JSON.parse(output.mock.calls[0][0]).status).toBe('failed');
  if (scenario === 'complete') expect(run).toHaveBeenCalledWith({ database, ...request });
});
