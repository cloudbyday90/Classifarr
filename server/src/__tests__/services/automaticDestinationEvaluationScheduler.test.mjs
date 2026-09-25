/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest, test, expect } from '@jest/globals';
import { registerAutomaticDestinationEvaluationSchedule, AUTOMATIC_DESTINATION_EVALUATION_TASK } from '../../services/automaticDestinationEvaluationScheduler.mjs';
import { createAutomaticDestinationEvaluationRepository, readAutomaticDestinationEvaluationStatus } from '../../services/automaticDestinationEvaluationRepository.mjs';
import { evaluateDestinationOutcomes } from '../../services/destinationOutcomeEvaluation.mjs';
import { runOperatorCorrectionPolicyEvaluation } from '../../scripts/runOperatorCorrectionPolicyEvaluation.mjs';

test('registers one shared startup/periodic handler and stops replaced work', async () => {
  const previous = { stop: jest.fn() }, worker = { stop: jest.fn(), run: jest.fn(async () => ({ status: 'unchanged' })) };
  const scheduler = { automaticDestinationEvaluationWorker: previous, schedule: jest.fn(), scheduleInitial: jest.fn() };
  registerAutomaticDestinationEvaluationSchedule(scheduler, { worker });
  expect(previous.stop).toHaveBeenCalledTimes(1);
  const handler = scheduler.schedule.mock.calls[0][2];
  expect(scheduler.schedule).toHaveBeenCalledWith(AUTOMATIC_DESTINATION_EVALUATION_TASK, '* * * * *', handler, null, { noOverlap: true });
  expect(scheduler.scheduleInitial).toHaveBeenCalledWith(AUTOMATIC_DESTINATION_EVALUATION_TASK, 120_000, handler);
  expect(await handler()).toEqual({ status: 'unchanged' });
  worker.run.mockResolvedValue({ status: 'failed', reason: 'private' });
  await expect(handler()).rejects.toThrow('automatic_destination_evaluation_unavailable');
});

test('repository bounds reads, rejects arbitrary report writes and honors cancellation', async () => {
  const client = { query: jest.fn(async sql => ({ rows: sql.startsWith('SELECT transaction_timestamp') ? [{ observed_at: '2026-09-24' }] : [] })) };
  const db = { withTransaction: callback => callback(client) };
  const repository = createAutomaticDestinationEvaluationRepository(db);
  expect(await repository.readState()).toBeNull();
  expect(await repository.readSnapshot()).toEqual({ observedAt: '2026-09-24', inputs: { rows: [], intake: [] } });
  expect(client.query).toHaveBeenCalledWith('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(client.query).toHaveBeenCalledWith("SET LOCAL transaction_timeout = '45s'");
  expect(() => repository.save('a'.repeat(64), {}, new Date())).toThrow('invalid_report');
  await repository.save('a'.repeat(64), evaluateDestinationOutcomes([], []), new Date());
  await repository.fail('evaluation_unavailable');
  const controller = new AbortController(); controller.abort();
  await expect(repository.readSnapshot(controller.signal)).rejects.toThrow();
});

test.each([undefined, { status: 'complete', report: { private: 'secret' } },
  { status: 'complete', report: evaluateDestinationOutcomes([], []) }, { status: 'stale', report: null }])('private reader validates checkpoint %j', async row => {
  const result = await readAutomaticDestinationEvaluationStatus({ query: async () => ({ rows: row ? [row] : [] }) });
  expect(result.status).toBe(row ? (row.report?.private ? 'invalid' : row.status) : 'never_run');
  expect(JSON.stringify(result)).not.toContain('secret');
});

test('existing CLI selects automatic status without invoking benchmark options', async () => {
  const env = { ...process.env };
  try {
    const evaluate = jest.fn(async () => ({ status: 'never_run' }));
    expect(await runOperatorCorrectionPolicyEvaluation({ argv: ['--automatic-status'], evaluate })).toEqual({ status: 'never_run' });
    expect(evaluate).toHaveBeenCalledWith({ automaticStatus: true });
    for (const option of ['--saved-decisions', '--source-pair']) {
      await expect(runOperatorCorrectionPolicyEvaluation({ argv: ['--automatic-status', option], evaluate })).rejects.toThrow('fixed_retention');
    }
  } finally { process.env = env; }
});
