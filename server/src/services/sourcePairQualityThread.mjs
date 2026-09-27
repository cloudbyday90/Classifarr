/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { parentPort, workerData } from 'node:worker_threads';
import { executeSourcePairQualityExperiment } from './sourcePairQualityExperiment.mjs';
import { assertOfflineEvaluationClean } from '../config/offlineEvaluation.mjs';
import { collectQualityObservation } from './qualityEvidenceObservation.mjs';
import { createQualityReviewPacket } from './qualityReviewPacket.mjs';
import { prepareSourcePairQualityProtocol } from './sourcePairQualityProtocol.mjs';
import { inventorySourceDescriptionKey } from './inventorySourceDescriptionIdentity.mjs';
import { receiveEvaluationSnapshot } from './evaluationVectorTransport.mjs';

try {
  const snapshot = await receiveEvaluationSnapshot(workerData, parentPort);
  workerData.snapshot = null;
  let result;
  if (workerData.operation === 'collect') result = await collectQualityObservation(snapshot, workerData.protocol);
  else if (workerData.operation === 'packet') {
    prepareSourcePairQualityProtocol(snapshot, workerData.protocol);
    const source = snapshot.inputs.source;
    result = createQualityReviewPacket(workerData.protocol, source.rows.map(row => [inventorySourceDescriptionKey(row), row]), source.libraries);
  } else result = await executeSourcePairQualityExperiment(snapshot, workerData.protocol, workerData.reference);
  assertOfflineEvaluationClean(); parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({ failure: ['quality_cohort_changed', 'quality_evidence_changed'].includes(error.message) ? error.message : 'quality_worker_unavailable' });
}
