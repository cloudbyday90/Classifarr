/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { runQueueRecoveryHandoff } from '../scripts/runQueueRecoveryHandoff.mjs';
import { QueueVacuumAttemptError } from '../services/queueVacuumFailure.mjs';
import { buildQueueVacuumDiagnosis } from '../services/queueVacuumDiagnosis.mjs';

function fixture() {
  const database = { pool: { end: jest.fn() } };
  return { database, args: ['--assess'], loadDatabase: jest.fn(async () => database), assertBoundary: jest.fn(),
    registerDb: jest.fn(), run: jest.fn(async ({ report }) => { report({ status: 'started' }); return { status: 'complete' }; }),
    log: { info: jest.fn(), warn: jest.fn() } };
}
test.each([[], ['--apply'], ['--assess', '--force']].map(args => [args]))('invalid command %j never loads authority', async args => {
  const f = fixture(); expect(await runQueueRecoveryHandoff({ ...f, args })).toBe(2);
  expect(f.loadDatabase).not.toHaveBeenCalled();
});
test.each([['complete', 0], ['idle', 75], ['deferred', 75]])('worker %s returns %i, always rechecks admission', async (status, code) => {
  const f = fixture();
  if (status !== 'complete') f.run.mockResolvedValue({ status, diagnosis: buildQueueVacuumDiagnosis(null, 'attempt_limit') });
  expect(await runQueueRecoveryHandoff(f)).toBe(code);
  expect(f.assertBoundary).toHaveBeenCalledWith(f.database);
  expect(f.run).toHaveBeenCalledWith({ database: f.database, automatic: true, report: expect.any(Function) });
  expect(f.database.pool.end).toHaveBeenCalledTimes(1); expect(f.registerDb).toHaveBeenLastCalledWith(null);
});
test.each(['boundary', 'execute', 'typed', 'load', 'cleanup'])('worker %s failure is not success or a raw error', async phase => {
  const f = fixture(), error = new Error('secret');
  if (phase === 'boundary') f.assertBoundary.mockRejectedValue(error);
  if (phase === 'execute') f.run.mockRejectedValue(error);
  if (phase === 'typed') f.run.mockRejectedValue(new QueueVacuumAttemptError('deadline', buildQueueVacuumDiagnosis(null, 'deadline')));
  if (phase === 'load') f.loadDatabase.mockRejectedValue(error);
  if (phase === 'cleanup') f.database.pool.end.mockRejectedValue(error);
  expect(await runQueueRecoveryHandoff(f)).toBe(1);
  if (phase === 'boundary') expect(f.run).not.toHaveBeenCalled();
  expect(JSON.stringify(f.log.warn.mock.calls)).not.toContain('secret');
});
