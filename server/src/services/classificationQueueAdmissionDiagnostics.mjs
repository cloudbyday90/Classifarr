/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import {
  getOllamaVerificationCapabilityState,
  OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS,
} from './ollamaVerificationCapabilityIdentity.mjs';

export const CLASSIFICATION_QUEUE_ADMISSION_DIAGNOSTICS_VERSION =
  'classification.queue_admission_diagnostics.v1';

export const CLASSIFICATION_QUEUE_WORKER_STATUS_IDS = Object.freeze({
  NOT_WAITING: 'not_waiting',
  AVAILABLE: 'available',
  WORKER_NOT_RUNNING: 'worker_not_running',
  NO_ELIGIBLE_WORKER: 'no_eligible_worker',
  AI_UNAVAILABLE: 'ai_unavailable',
  DISPATCH_CHECK_FAILED: 'dispatch_check_failed',
});

export const CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS = Object.freeze({
  NOT_BLOCKED: 'not_blocked',
  MODEL_CHANGED: 'model_changed',
});

function toNonNegativeInteger(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getNonMetadataProcessingCount(runtimeState = {}) {
  const totalProcessing = toNonNegativeInteger(runtimeState.processing);
  const metadataEnrichmentProcessing = toNonNegativeInteger(
    runtimeState.processingByType?.metadata_enrichment,
  );
  return Math.max(totalProcessing - metadataEnrichmentProcessing, 0);
}

function getGeneralWorkerCapacity(runtimeState = {}) {
  const configured = Number(runtimeState.queueConcurrency?.generalWorkers);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 1;
}

/**
 * Produces an identity-free snapshot for a queued classification. Worker
 * eligibility and strict-verification state intentionally remain separate:
 * a changed Ollama model stops strict verification only, not general routing
 * or task retries.
 */
export function buildClassificationQueueAdmissionDiagnostics({
  queueStats = {},
  dispatchBlockers = {},
  runtimeState = {},
  providerConfiguration = null,
} = {}) {
  const pending = toNonNegativeInteger(queueStats.pending);
  const waitingForClassification = pending > 0;
  const workerRunning = runtimeState.workerRunning === true;
  const aiAvailable = runtimeState.aiAvailable !== false;
  const noEligibleWorker = dispatchBlockers.hasProcessingClassification === true
    || getNonMetadataProcessingCount(runtimeState) >= getGeneralWorkerCapacity(runtimeState);
  const capabilityState = getOllamaVerificationCapabilityState(providerConfiguration || {});

  let workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.NOT_WAITING;
  if (waitingForClassification) {
    if (!workerRunning) {
      workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.WORKER_NOT_RUNNING;
    } else if (dispatchBlockers.lookupFailed === true) {
      workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.DISPATCH_CHECK_FAILED;
    } else if (!aiAvailable) {
      workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.AI_UNAVAILABLE;
    } else if (noEligibleWorker) {
      workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.NO_ELIGIBLE_WORKER;
    } else {
      workerStatusId = CLASSIFICATION_QUEUE_WORKER_STATUS_IDS.AVAILABLE;
    }
  }

  return Object.freeze({
    version: CLASSIFICATION_QUEUE_ADMISSION_DIAGNOSTICS_VERSION,
    queue: Object.freeze({ statusId: workerStatusId }),
    strictVerification: Object.freeze({
      statusId: capabilityState.statusId === OLLAMA_VERIFICATION_CAPABILITY_STATUS_IDS.MODEL_CHANGED
        ? CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS.MODEL_CHANGED
        : CLASSIFICATION_QUEUE_STRICT_VERIFICATION_STATUS_IDS.NOT_BLOCKED,
    }),
    sideEffects: Object.freeze({
      providerCalled: false,
      providerAvailabilityChecked: false,
      configurationPersisted: false,
      routingChanged: false,
      retryQueued: false,
    }),
  });
}
