/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS,
} from './policyProfileRefreshOutboxWorkerVocabulary.mjs';

const POLICY_PROFILE_REFRESH_FAILURE_CLASSIFICATION_VERSION =
  'policy.profile_refresh_failure_classification.v1';

const POLICY_PROFILE_REFRESH_FAILURE_CLASS_IDS = Object.freeze({
  TRANSIENT_DEPENDENCY: 'transient_dependency',
  PERMANENT_CONFIGURATION: 'permanent_configuration',
  UNKNOWN: 'unknown',
});

const POLICY_NATIVE_PROFILE_REFRESH_TERMINAL_ACTION_IDS = Object.freeze({
  SCHEDULE_SUCCESSOR: 'schedule_successor',
  BLOCK_SUCCESSOR: 'block_successor',
});

const POLICY_PROFILE_REFRESH_CONFIGURATION_ERROR_CODE =
  'POLICY_PROFILE_REFRESH_CONFIGURATION_INVALID';

const TRANSIENT_NODE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETUNREACH',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function normalizeErrorCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function getHttpStatusCode(error = {}) {
  const candidates = [error.statusCode, error.status, error.response?.status];
  return candidates.find(value => Number.isInteger(Number(value))) || null;
}

function isTransientHttpStatus(statusCode) {
  const normalizedStatusCode = Number(statusCode);
  return normalizedStatusCode === 408 ||
    normalizedStatusCode === 425 ||
    normalizedStatusCode === 429 ||
    normalizedStatusCode >= 500;
}

function buildClassification({ classId, failureCode, retryable }) {
  return Object.freeze({
    version: POLICY_PROFILE_REFRESH_FAILURE_CLASSIFICATION_VERSION,
    classId,
    failureCode,
    retryable,
  });
}

function createPolicyProfileRefreshConfigurationError({ methodName } = {}) {
  const normalizedMethodName = typeof methodName === 'string' && methodName.trim()
    ? methodName.trim()
    : 'profile operation';
  const error = new TypeError(`Policy profile refresh requires ${normalizedMethodName}.`);
  error.code = POLICY_PROFILE_REFRESH_CONFIGURATION_ERROR_CODE;
  return error;
}

function classifyPolicyProfileRefreshFailure(error) {
  const errorCode = normalizeErrorCode(error?.code);

  if (errorCode === POLICY_PROFILE_REFRESH_CONFIGURATION_ERROR_CODE) {
    return buildClassification({
      classId: POLICY_PROFILE_REFRESH_FAILURE_CLASS_IDS.PERMANENT_CONFIGURATION,
      failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.CONFIGURATION_INVALID,
      retryable: false,
    });
  }

  if (
    error?.name === 'AbortError' ||
    TRANSIENT_NODE_ERROR_CODES.has(errorCode) ||
    isTransientHttpStatus(getHttpStatusCode(error))
  ) {
    return buildClassification({
      classId: POLICY_PROFILE_REFRESH_FAILURE_CLASS_IDS.TRANSIENT_DEPENDENCY,
      failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.TRANSIENT_DEPENDENCY_FAILED,
      retryable: true,
    });
  }

  return buildClassification({
    classId: POLICY_PROFILE_REFRESH_FAILURE_CLASS_IDS.UNKNOWN,
    failureCode: POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.UNKNOWN_FAILED,
    retryable: true,
  });
}

function evaluatePolicyNativeProfileRefreshTerminalFailure({ failureCode } = {}) {
  const normalizedFailureCode = typeof failureCode === 'string' ? failureCode.trim() : '';
  const scheduleSuccessor = [
    POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.EXECUTION_FAILED,
    POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.LEASE_EXPIRED,
    POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.TRANSIENT_DEPENDENCY_FAILED,
    POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.UNKNOWN_FAILED,
  ].includes(normalizedFailureCode);

  const configurationFailure = normalizedFailureCode ===
    POLICY_PROFILE_REFRESH_OUTBOX_WORKER_FAILURE_IDS.CONFIGURATION_INVALID;
  let reasonCodes;
  if (scheduleSuccessor) {
    reasonCodes = ['terminal_failure_recovery_eligible'];
  } else if (configurationFailure) {
    reasonCodes = ['terminal_failure_configuration_invalid'];
  } else {
    reasonCodes = ['terminal_failure_code_unrecognized'];
  }

  return Object.freeze({
    version: POLICY_PROFILE_REFRESH_FAILURE_CLASSIFICATION_VERSION,
    failureCode: normalizedFailureCode || null,
    actionId: scheduleSuccessor
      ? POLICY_NATIVE_PROFILE_REFRESH_TERMINAL_ACTION_IDS.SCHEDULE_SUCCESSOR
      : POLICY_NATIVE_PROFILE_REFRESH_TERMINAL_ACTION_IDS.BLOCK_SUCCESSOR,
    scheduleSuccessor,
    reasonCodes,
  });
}

export {
  classifyPolicyProfileRefreshFailure,
  createPolicyProfileRefreshConfigurationError,
  evaluatePolicyNativeProfileRefreshTerminalFailure,
  POLICY_NATIVE_PROFILE_REFRESH_TERMINAL_ACTION_IDS,
  POLICY_PROFILE_REFRESH_CONFIGURATION_ERROR_CODE,
  POLICY_PROFILE_REFRESH_FAILURE_CLASSIFICATION_VERSION,
  POLICY_PROFILE_REFRESH_FAILURE_CLASS_IDS,
};
