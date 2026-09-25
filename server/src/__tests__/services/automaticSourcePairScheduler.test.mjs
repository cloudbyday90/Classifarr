/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { registerAutomaticSourcePairSchedule, AUTOMATIC_SOURCE_PAIR_TASK } from '../../services/automaticSourcePairScheduler.mjs';
import { readAutomaticSourcePairStatus, createAutomaticSourcePairRepository } from '../../services/automaticSourcePairRepository.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';

test('registers shared startup/periodic work and replaces stopped workers; deferrals are not errors', async () => {
  const previous = { stop: jest.fn() }, worker = { run: jest.fn(async () => ({ status: 'deferred', reason: 'busy' })) };
  const scheduler = { automaticSourcePairWorker: previous, schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerAutomaticSourcePairSchedule(scheduler, { worker });
  expect(previous.stop).toHaveBeenCalledTimes(1);
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith(AUTOMATIC_SOURCE_PAIR_TASK, '* * * * *', handler, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith(AUTOMATIC_SOURCE_PAIR_TASK, 180000, handler);
  expect(await handler()).toMatchObject({ status: 'deferred' });
  worker.run.mockResolvedValue({ status: 'failed', reason: 'PRIVATE' });
  await expect(handler()).rejects.toThrow('automatic_source_pair_evaluation_unavailable');
});

test.each([undefined, { status: 'complete', report: { secret: 'PRIVATE' } }, { status: 'stale', report: null }])(
  'status reader withholds unexpected content %j', async row => {
    const result = await readAutomaticSourcePairStatus({ query: async () => ({ rows: row ? [row] : [] }) });
    expect(result.status).toBe(row ? row.status === 'complete' ? 'invalid' : row.status : 'never_run');
    expect(result.report).toBeNull(); expect(JSON.stringify(result)).not.toContain('PRIVATE');
  });

test('repository rejects invalid reports before publication and checks cancellation', async () => {
  const client = { query: jest.fn(async () => ({ rows: [] })) };
  const repository = createAutomaticSourcePairRepository({ withTransaction: callback => callback(client) });
  expect(await repository.readState()).toBeNull();
  expect(() => repository.save('a'.repeat(64), {}, new Date())).toThrow('invalid');
  const controller = new AbortController(); controller.abort();
  await expect(repository.readSnapshot(controller.signal)).rejects.toThrow();
});

test('existing CLI queries cached pair status with no benchmark/model work', async () => {
  const env = { ...process.env };
  try {
    const evaluate = jest.fn(async () => ({ status: 'never_run' }));
    await runOperatorCorrectionPolicyEvaluation({ argv: ['--automatic-source-pair-status'], evaluate });
    expect(evaluate).toHaveBeenCalledWith({ automaticSourcePairStatus: true });
    for (const argv of [['--source-pair'], ['--automatic-status'], ['--saved-decisions'], ['--size', '100']]) {
      await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--automatic-source-pair-status', ...argv], evaluate })).rejects.toThrow('fixed_retention');
    }
  } finally { process.env = env; }
});
