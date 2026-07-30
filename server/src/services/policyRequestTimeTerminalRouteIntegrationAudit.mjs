/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_AUDIT_VERSION =
  'policy.request_time_terminal_route_integration_audit.v1';

const POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS = Object.freeze({
  REQUEST_IMPORT_QUEUE: 'request_import_queue',
  NATIVE_PENDING_ROUTE: 'native_pending_route',
});

const POLICY_REQUEST_TIME_PROOF_MODE_IDS = Object.freeze({
  QUEUE_QUESTION_REDUCTION: 'queue_question_reduction',
  OUTCOME_ONLY: 'outcome_only',
});

const POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS = Object.freeze({
  MISSING_REQUIRED_CALLER: 'missing_required_caller',
  DUPLICATE_CALLER: 'duplicate_caller',
  UNKNOWN_CALLER: 'unknown_caller',
  CALLER_CONFIGURATION_MISMATCH: 'caller_configuration_mismatch',
  CALLER_SOURCE_PATH_NOT_FOUND: 'caller_source_path_not_found',
  CONTRACT_PATH_NOT_FOUND: 'contract_path_not_found',
  SOURCE_UNREADABLE: 'source_unreadable',
  MISSING_REQUIRED_SOURCE_FRAGMENT: 'missing_required_source_fragment',
  MISSING_PROOF_MODE: 'missing_proof_mode',
  UNKNOWN_PROOF_MODE: 'unknown_proof_mode',
  MISSING_OUTCOME_ONLY_FALLBACK: 'missing_outcome_only_fallback',
  DIRECT_LEARNING_ALLOWED: 'direct_learning_allowed',
  QUEUE_PROOF_ADAPTER_PATH_NOT_FOUND: 'queue_proof_adapter_path_not_found',
  QUEUE_PROOF_PRODUCER_PATH_NOT_FOUND: 'queue_proof_producer_path_not_found',
});

const PROOF_MODE_IDS = Object.freeze(Object.values(POLICY_REQUEST_TIME_PROOF_MODE_IDS));
const REQUIRED_CALLER_IDS = Object.freeze(
  Object.values(POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS)
);
const QUEUE_PROOF_ADAPTER_PATH =
  'server/src/services/policyRequestTimeQueueQuestionReduction.mjs';
const QUEUE_PROOF_PRODUCER_PATH =
  'server/src/services/policyRuntimeQueueQuestionReductionProducer.mjs';

const REQUEST_TIME_TERMINAL_ROUTE_CALLERS = Object.freeze([
  Object.freeze({
    id: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.REQUEST_IMPORT_QUEUE,
    label: 'Request/import classification queue terminal routing',
    sourcePath: 'server/src/services/queueTaskProcessorService.mjs',
    contractPaths: [
      'server/src/services/policyRequestImportDestinationAdmission.mjs',
      'server/src/services/policyRequestTimeLearning.mjs',
      QUEUE_PROOF_PRODUCER_PATH,
    ],
    proofModeIds: [
      POLICY_REQUEST_TIME_PROOF_MODE_IDS.QUEUE_QUESTION_REDUCTION,
      POLICY_REQUEST_TIME_PROOF_MODE_IDS.OUTCOME_ONLY,
    ],
    outcomeOnlyFallbackRequired: true,
    directLearningAllowed: false,
    requiredSourceFragments: [
      {
        path: 'server/src/services/queueTaskProcessorService.mjs',
        value: 'policyRequestImportDestinationAdmissionService.build({',
      },
      {
        path: 'server/src/services/queueTaskProcessorService.mjs',
        value: 'classifyQueueTask(task, {',
      },
      {
        path: 'server/src/services/queueTaskProcessorService.mjs',
        value: 'queueQuestionReduction: result.runtimeQueueQuestionReduction,',
      },
      {
        path: 'server/src/services/policyNativeClassificationQuestionHandoff.mjs',
        value: 'buildPolicyRuntimeQueueQuestionReductionProducer({',
      },
      {
        path: 'server/src/services/policyRequestImportDestinationAdmission.mjs',
        value: 'buildOutcomeOnlyLearningDecision(',
      },
    ],
  }),
  Object.freeze({
    id: POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS.NATIVE_PENDING_ROUTE,
    label: 'Native pending terminal routing',
    sourcePath: 'server/src/services/policyNativePendingRouteOutcomePersistence.mjs',
    contractPaths: [
      'server/src/services/policyNativePendingRouteOutcome.mjs',
      'server/src/services/policyRequestTimeEvent.mjs',
    ],
    proofModeIds: [
      POLICY_REQUEST_TIME_PROOF_MODE_IDS.OUTCOME_ONLY,
    ],
    outcomeOnlyFallbackRequired: true,
    directLearningAllowed: false,
    requiredSourceFragments: [
      {
        path: 'server/src/services/policyNativePendingRouteOutcomePersistence.mjs',
        value: 'policyNativePendingRouteOutcomeService.build({',
      },
      {
        path: 'server/src/services/policyNativePendingRouteOutcomePersistence.mjs',
        value: 'routeOutcome.statusId !== POLICY_NATIVE_PENDING_ROUTE_OUTCOME_STATUS_IDS.OUTCOME_ONLY',
      },
      {
        path: 'server/src/services/policyNativePendingRouteOutcomePersistence.mjs',
        value: 'routeOutcome.audit.ok !== true',
      },
    ],
  }),
]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeString(value, maximumLength = 240) {
  if (typeof value !== 'string') return '';

  return value
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximumLength);
}

function uniqueStrings(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function pathExists(relativePath) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller paths are server-owned registry values.
  return existsSync(resolve(REPO_ROOT, relativePath));
}

function readSource(relativePath) {
  if (!pathExists(relativePath)) return null;

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller paths are server-owned registry values.
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
  } catch {
    return null;
  }
}

function buildIssue(riskId, message, details = {}) {
  return {
    riskId,
    message,
    ...details,
  };
}

function normalizeCaller(caller = {}) {
  const source = asObject(caller);

  return {
    id: normalizeString(source.id, 80),
    label: normalizeString(source.label, 160),
    sourcePath: normalizeString(source.sourcePath, 240),
    contractPaths: uniqueStrings(asArray(source.contractPaths)
      .map(path => normalizeString(path, 240))),
    proofModeIds: uniqueStrings(asArray(source.proofModeIds)
      .map(proofModeId => normalizeString(proofModeId, 80))),
    outcomeOnlyFallbackRequired: source.outcomeOnlyFallbackRequired === true,
    directLearningAllowed: source.directLearningAllowed === true,
    requiredSourceFragments: asArray(source.requiredSourceFragments)
      .map(fragment => ({
        path: normalizeString(asObject(fragment).path, 240),
        value: normalizeString(asObject(fragment).value, 240),
      })),
  };
}

function buildCallerSummary(caller = {}) {
  return {
    id: caller.id || null,
    label: caller.label || null,
    sourcePath: caller.sourcePath || null,
    contractPaths: caller.contractPaths,
    proofModeIds: caller.proofModeIds,
    outcomeOnlyFallbackRequired: caller.outcomeOnlyFallbackRequired,
    directLearningAllowed: caller.directLearningAllowed,
  };
}

function readSourceCached(path, readSourceFile, sourceCache) {
  if (sourceCache.has(path)) return sourceCache.get(path);

  const content = readSourceFile(path);
  sourceCache.set(path, typeof content === 'string' ? content : null);
  return sourceCache.get(path);
}

function validateCaller(caller = {}, {
  expectedCallerById,
  readSourceFile,
  checkPathExists,
  sourceCache,
} = {}) {
  const candidate = normalizeCaller(caller);
  const expected = expectedCallerById.get(candidate.id);
  const issues = [];

  if (!expected) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.UNKNOWN_CALLER,
      'Terminal request-time caller is not in the server-owned integration registry.',
      { callerId: candidate.id || null }
    ));
    return { caller: candidate, issues };
  }

  const canonical = normalizeCaller(expected);
  if (
    candidate.label !== canonical.label ||
    candidate.sourcePath !== canonical.sourcePath ||
    candidate.outcomeOnlyFallbackRequired !== canonical.outcomeOnlyFallbackRequired ||
    candidate.directLearningAllowed !== canonical.directLearningAllowed ||
    JSON.stringify(candidate.contractPaths) !== JSON.stringify(canonical.contractPaths) ||
    JSON.stringify(candidate.proofModeIds) !== JSON.stringify(canonical.proofModeIds)
  ) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.CALLER_CONFIGURATION_MISMATCH,
      'Terminal request-time caller must retain the canonical source, proof, and fallback configuration.',
      { callerId: candidate.id }
    ));
  }

  if (candidate.proofModeIds.length === 0) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_PROOF_MODE,
      'Terminal request-time callers must declare a proof mode or outcome-only fallback.',
      { callerId: candidate.id }
    ));
  }

  candidate.proofModeIds
    .filter(proofModeId => !PROOF_MODE_IDS.includes(proofModeId))
    .forEach(proofModeId => {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.UNKNOWN_PROOF_MODE,
        'Terminal request-time callers must use an approved proof mode.',
        { callerId: candidate.id, proofModeId }
      ));
    });

  if (
    candidate.outcomeOnlyFallbackRequired !== true ||
    !candidate.proofModeIds.includes(POLICY_REQUEST_TIME_PROOF_MODE_IDS.OUTCOME_ONLY)
  ) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_OUTCOME_ONLY_FALLBACK,
      'Terminal request-time callers must retain an outcome-only fallback for missing or invalid proof.',
      { callerId: candidate.id }
    ));
  }

  if (candidate.directLearningAllowed === true) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.DIRECT_LEARNING_ALLOWED,
      'Terminal request-time callers cannot directly authorize durable learning.',
      { callerId: candidate.id }
    ));
  }

  if (checkPathExists && !pathExists(canonical.sourcePath)) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.CALLER_SOURCE_PATH_NOT_FOUND,
      'Terminal request-time caller source path is missing.',
      { callerId: candidate.id, path: canonical.sourcePath }
    ));
  }

  canonical.contractPaths.forEach(path => {
    if (checkPathExists && !pathExists(path)) {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.CONTRACT_PATH_NOT_FOUND,
        'Terminal request-time contract path is missing.',
        { callerId: candidate.id, path }
      ));
    }
  });

  canonical.requiredSourceFragments.forEach(fragment => {
    const source = readSourceCached(fragment.path, readSourceFile, sourceCache);
    if (source === null) {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.SOURCE_UNREADABLE,
        'Terminal request-time source could not be read for integration verification.',
        { callerId: candidate.id, path: fragment.path }
      ));
      return;
    }

    if (!source.includes(fragment.value)) {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_REQUIRED_SOURCE_FRAGMENT,
        'Terminal request-time source no longer contains a required guarded handoff.',
        { callerId: candidate.id, path: fragment.path }
      ));
    }
  });

  return { caller: candidate, issues };
}

function listPolicyRequestTimeTerminalRouteCallers() {
  return REQUEST_TIME_TERMINAL_ROUTE_CALLERS;
}

function buildPolicyRequestTimeTerminalRouteIntegrationAudit({
  callers = REQUEST_TIME_TERMINAL_ROUTE_CALLERS,
  checkPathExists = true,
  readSourceFile = readSource,
} = {}) {
  const expectedCallerById = new Map(
    REQUEST_TIME_TERMINAL_ROUTE_CALLERS.map(caller => [caller.id, caller])
  );
  const normalizedCallers = asArray(callers).map(normalizeCaller);
  const sourceCache = new Map();
  const issues = [];
  const callerIds = normalizedCallers.map(caller => caller.id);

  REQUIRED_CALLER_IDS
    .filter(callerId => !callerIds.includes(callerId))
    .forEach(callerId => {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.MISSING_REQUIRED_CALLER,
        'A required terminal request-time caller is missing from the integration audit.',
        { callerId }
      ));
    });

  uniqueStrings(callerIds)
    .filter(callerId => callerIds.filter(id => id === callerId).length > 1)
    .forEach(callerId => {
      issues.push(buildIssue(
        POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.DUPLICATE_CALLER,
        'Terminal request-time callers must be listed only once.',
        { callerId: callerId || null }
      ));
    });

  const callerResults = normalizedCallers.map(caller => validateCaller(caller, {
    expectedCallerById,
    readSourceFile,
    checkPathExists,
    sourceCache,
  }));
  issues.push(...callerResults.flatMap(result => result.issues));

  if (checkPathExists && !pathExists(QUEUE_PROOF_ADAPTER_PATH)) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.QUEUE_PROOF_ADAPTER_PATH_NOT_FOUND,
      'The queue-bound request-time proof adapter is missing.',
      { path: QUEUE_PROOF_ADAPTER_PATH }
    ));
  }

  if (checkPathExists && !pathExists(QUEUE_PROOF_PRODUCER_PATH)) {
    issues.push(buildIssue(
      POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS.QUEUE_PROOF_PRODUCER_PATH_NOT_FOUND,
      'The queue-bound question-reduction producer is missing.',
      { path: QUEUE_PROOF_PRODUCER_PATH }
    ));
  }

  const queueProofCallerIds = normalizedCallers
    .filter(caller => caller.proofModeIds.includes(
      POLICY_REQUEST_TIME_PROOF_MODE_IDS.QUEUE_QUESTION_REDUCTION
    ))
    .map(caller => caller.id);
  const queueProofStatusId = queueProofCallerIds.length > 0
    ? 'active'
    : 'available_no_live_producer';

  const result = {
    version: POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_AUDIT_VERSION,
    stepId: 'request_time_terminal_route_integration_audit',
    ok: issues.length === 0,
    callerCount: normalizedCallers.length,
    coveredCallerCount: callerResults.filter(result => result.issues.length === 0).length,
    callers: callerResults.map(result => buildCallerSummary(result.caller)),
    queueQuestionReduction: {
      adapterPath: QUEUE_PROOF_ADAPTER_PATH,
      producerPath: QUEUE_PROOF_PRODUCER_PATH,
      statusId: queueProofStatusId,
      activeCallerIds: queueProofCallerIds,
    },
    issues,
    sideEffects: {
      filesRead: true,
      filesWritten: false,
      storageChanged: false,
      routingChanged: false,
      learningWritten: false,
      profileRefreshQueued: false,
    },
    nextStep: {
      stepId: 'request_time_learning_provenance_cutover',
      label: 'Request-Time Learning Provenance Cutover',
      reason: queueProofStatusId === 'active'
        ? 'Queue-bound proof is active; audit the remaining request-time callers and retire obsolete direct-proof compatibility paths.'
        : 'The queue proof adapter has no live producer; define one only after it can derive current evidence without competing with the direct-plan handoff.',
    },
  };

  return result;
}

export {
  POLICY_REQUEST_TIME_PROOF_MODE_IDS,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_CALLER_IDS,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_AUDIT_VERSION,
  POLICY_REQUEST_TIME_TERMINAL_ROUTE_INTEGRATION_RISK_IDS,
  buildPolicyRequestTimeTerminalRouteIntegrationAudit,
  listPolicyRequestTimeTerminalRouteCallers,
};
