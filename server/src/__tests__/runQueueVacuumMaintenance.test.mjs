/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runQueueVacuumMaintenanceCommand } from '../scripts/runQueueVacuumMaintenance.mjs';

function fixture(status = 'complete') {
  const database = { pool: { end: jest.fn() } };
  const runQueueVacuumMaintenance = jest.fn().mockResolvedValue({ status });
  const inspectQueueVacuum = jest.fn().mockResolvedValue({ status: 'autovacuum_enabled' });
  const options = { args: ['--apply'], loadDatabase: jest.fn().mockResolvedValue(database),
    loadMaintenance: jest.fn().mockResolvedValue({ runQueueVacuumMaintenance }),
    loadObservation: jest.fn().mockResolvedValue({ inspectQueueVacuum }), output: jest.fn() };
  return { database, runQueueVacuumMaintenance, inspectQueueVacuum, options };
}
test.each([[[], 0], [['--help'], 0], [['--sql', 'VACUUM other'], 2], [['--apply', 'task_queue'], 2]])('args %j never connect', async (args, code) => {
  const f = fixture();
  expect(await runQueueVacuumMaintenanceCommand({ ...f.options, args })).toBe(code);
  expect(f.options.loadDatabase).not.toHaveBeenCalled();
});
test.each([['complete', 0], ['deferred', 75]])('apply %s returns %i', async (status, code) => {
  const f = fixture(status);
  expect(await runQueueVacuumMaintenanceCommand(f.options)).toBe(code);
  expect(f.runQueueVacuumMaintenance).toHaveBeenCalledWith({ database: f.database });
  expect(f.options.loadObservation).not.toHaveBeenCalled();
  expect(f.database.pool.end).toHaveBeenCalledTimes(1);
});
test('inspect never imports the maintenance executor', async () => {
  const f = fixture();
  expect(await runQueueVacuumMaintenanceCommand({ ...f.options, args: ['--inspect'] })).toBe(0);
  expect(f.options.loadMaintenance).not.toHaveBeenCalled();
});
test.each(['load', 'run', 'end'])('%s failure is redacted', async stage => {
  const f = fixture();
  (stage === 'load' ? f.options.loadDatabase : stage === 'run' ? f.runQueueVacuumMaintenance : f.database.pool.end)
    .mockRejectedValue(new Error('private database detail'));
  expect(await runQueueVacuumMaintenanceCommand(f.options)).toBe(1);
  expect(JSON.stringify(f.options.output.mock.calls)).not.toContain('private');
});
