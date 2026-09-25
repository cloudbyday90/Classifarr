/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { executeAutomaticSourcePair } from './automaticSourcePairExecution.mjs';
import { assertOfflineEvaluationClean } from '../config/offlineEvaluation.mjs';

try {
  const result = await executeAutomaticSourcePair(workerData.snapshot, workerData.state, { includePlan: workerData.includePlan === true });
  assertOfflineEvaluationClean();
  parentPort.postMessage({ result });
} catch {
  parentPort.postMessage({ failed: true });
}
