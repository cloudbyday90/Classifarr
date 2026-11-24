/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { executeAutomaticSourcePair } from './automaticSourcePairExecution.mjs';
import { assertOfflineEvaluationClean } from '../config/offlineEvaluation.mjs';
import { receiveEvaluationSnapshot } from './evaluationVectorTransport.mjs';
import { sourcePairThreadFailure } from './automaticSourcePairThreadFailure.mjs';

try {
  const snapshot = await receiveEvaluationSnapshot(workerData, parentPort);
  workerData.snapshot = null;
  const includePlan = workerData.includePlan === true;
  let reply;
  try {
    reply = { result: await executeAutomaticSourcePair(snapshot, workerData.state, { includePlan }) };
  } catch (error) {
    reply = sourcePairThreadFailure(error, includePlan);
  }
  assertOfflineEvaluationClean();
  parentPort.postMessage(reply);
} catch {
  parentPort.postMessage({ failed: true });
}
