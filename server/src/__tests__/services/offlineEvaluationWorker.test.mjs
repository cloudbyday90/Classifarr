/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { test, expect } from '@jest/globals';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { isOfflineEvaluationWorker } from '../../config/offlineEvaluation.mjs';

test('fixed worker skips local env loading and blocks database access even if an evaluator catches the error', async () => {
  expect(isOfflineEvaluationWorker).toBe(false);
  const worker = new Worker(new URL('../fixtures/offlineEvaluationWorkerFixture.mjs', import.meta.url), {
    workerData: { role: 'automatic-source-pair' }, env: { LOG_LEVEL: 'fatal', FILE_LOGGING_ENABLED: 'false' }, execArgv: [],
  });
  try {
    const [result] = await once(worker, 'message');
    expect(result).toEqual({ offline: true, environmentSkipped: true, inheritedSecret: false,
      queryBlocked: true, connectBlocked: true, publicationBlocked: true });
  } finally { await worker.terminate(); }
});
