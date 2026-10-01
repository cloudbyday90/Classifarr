/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runImageIndexMaintenanceCommand } from '../scripts/runImageIndexMaintenance.mjs';

function fixture(status = 'complete') {
  const database = { pool: { end: jest.fn() } };
  const runImageIndexMaintenance = jest.fn().mockResolvedValue({ status });
  const options = { args: ['--apply'], loadDatabase: jest.fn().mockResolvedValue(database),
    loadMaintenance: jest.fn().mockResolvedValue({ runImageIndexMaintenance }), output: jest.fn() };
  return { database, runImageIndexMaintenance, options };
}
test.each([[[], 0], [['--help'], 0], [['--sql', 'DROP TABLE x'], 2], [['--apply', 'index'], 2]])('arguments %j never load database', async (args, code) => {
  const f = fixture();
  await expect(runImageIndexMaintenanceCommand({ ...f.options, args })).resolves.toBe(code);
  expect(f.options.loadDatabase).not.toHaveBeenCalled();
});
test.each([['complete', 0], ['no_work', 0], ['deferred', 75]])('status %s has exit code %s', async (status, code) => {
  const f = fixture(status);
  await expect(runImageIndexMaintenanceCommand(f.options)).resolves.toBe(code);
  expect(f.runImageIndexMaintenance).toHaveBeenCalledWith({ database: f.database });
  expect(f.database.pool.end).toHaveBeenCalledTimes(1);
});
test.each(['database', 'maintenance', 'cleanup'])('%s errors are redacted and fail closed', async stage => {
  const f = fixture();
  const target = stage === 'database' ? f.options.loadDatabase : stage === 'maintenance' ? f.runImageIndexMaintenance : f.database.pool.end;
  target.mockRejectedValue(new Error('synthetic-secret-postgresql://password@host'));
  await expect(runImageIndexMaintenanceCommand(f.options)).resolves.toBe(1);
  expect(JSON.stringify(f.options.output.mock.calls)).not.toContain('synthetic-secret');
});
