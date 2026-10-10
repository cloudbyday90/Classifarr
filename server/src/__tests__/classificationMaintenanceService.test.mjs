/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import { createMockLogger } from './helpers/mockFactory.mjs';
import { ClassificationMaintenanceService } from '../services/classificationMaintenanceService.mjs';
import { createStaleClassificationHandoffRepository } from '../services/staleClassificationHandoffRepository.mjs';
import { STALE_AWAITING_DECISION_DAYS } from '../constants/classificationFlow.mjs';

test('empty handoff is quiet', async () => {
  const logger = createMockLogger();
  const handoff = jest.fn().mockResolvedValue([]);
  await new ClassificationMaintenanceService({ logger, handoffRepository: { handoff } }).cleanupStaleAwaitingDecisions();
  expect(handoff).toHaveBeenCalledTimes(1);
  expect(logger.info).not.toHaveBeenCalled();
});

test('logs only the committed count', async () => {
  const logger = createMockLogger();
  const handoff = jest.fn().mockResolvedValue([{ classification_id: 1, queue_task_id: 2 }]);
  await new ClassificationMaintenanceService({ logger, handoffRepository: { handoff } }).cleanupStaleAwaitingDecisions();
  expect(logger.info).toHaveBeenCalledWith('Stale awaiting_decision cleanup: tasks admitted', { count: 1 });
});

test('unknown database errors remain visible without leaking SQL or titles; no immediate retries', async () => {
  const logger = createMockLogger();
  const handoff = jest.fn().mockRejectedValue(new Error('private title / secret SQL'));
  await expect(new ClassificationMaintenanceService({ logger, handoffRepository: { handoff } })
    .cleanupStaleAwaitingDecisions()).resolves.toBeUndefined();
  expect(handoff).toHaveBeenCalledTimes(1);
  expect(logger.error).toHaveBeenCalledWith('Stale awaiting_decision cleanup failed', {
    code: 'stale_classification_handoff_failed',
    recovery: 'No partial handoff is committed. Check database availability and retry on the next scheduled run.',
  });
});

test('repository uses one scoped transaction, fixed limits and parameterized threshold', async () => {
  const rows = [{ classification_id: 2, queue_task_id: 3 }];
  const client = { query: jest.fn().mockResolvedValue({ rows }) };
  const withTransaction = jest.fn(fn => fn(client));
  const logger = createMockLogger();
  await new ClassificationMaintenanceService({ db: { withTransaction }, logger }).cleanupStaleAwaitingDecisions();
  expect(withTransaction).toHaveBeenCalledTimes(1);
  expect(client.query).toHaveBeenNthCalledWith(1, "SET LOCAL statement_timeout = '10s'");
  expect(client.query).toHaveBeenNthCalledWith(2, "SET LOCAL lock_timeout = '1s'");
  expect(client.query).toHaveBeenNthCalledWith(3, expect.stringContaining('FOR UPDATE OF history SKIP LOCKED'),
    [STALE_AWAITING_DECISION_DAYS, 100]);
});

test('repository propagates failures so the transaction wrapper can roll back', async () => {
  const failure = new Error('fixture');
  const query = jest.fn().mockRejectedValue(failure);
  const repository = createStaleClassificationHandoffRepository({ withTransaction: fn => fn({ query }) });
  await expect(repository.handoff()).rejects.toBe(failure);
  expect(query).toHaveBeenCalledTimes(1);
});
