/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { executeAutomaticSourcePair } from './automaticSourcePairExecution.mjs';
import { assertOfflineEvaluationClean } from '../config/offlineEvaluation.mjs';
import { receiveEvaluationSnapshot } from './evaluationVectorTransport.mjs';

try {
  const snapshot = await receiveEvaluationSnapshot(workerData, parentPort);
  workerData.snapshot = null;
  const result = await executeAutomaticSourcePair(snapshot, workerData.state, { includePlan: workerData.includePlan === true });
  assertOfflineEvaluationClean();
  parentPort.postMessage({ result });
} catch {
  parentPort.postMessage({ failed: true });
}
