/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { setTimeout as sleepFor } from 'node:timers/promises';
import { OperationController } from '../utils/operationController.mjs';
import {
  classifyDbSqlState,
  isRetryableDbConflictError,
} from '../utils/ragLoopHelpers.mjs';
import {
  buildPendingRetryResult as _buildPendingRetryResult,
  isAiTransientAvailabilityError as _isAiTransientAvailabilityError,
  resolveAiFailureClassification as _resolveAiFailureClassification,
  resolveRetryReason as _resolveRetryReason,
  RETRY_DELAY_MS as _RETRY_DELAY_MS,
} from './classificationAiFailureUtils.mjs';

export const RAG_LOOP_MIN_TIMEOUT_MS = 1000;
export const RAG_LOOP_MAX_TIMEOUT_MS = 15000;
export const RETRY_DELAY_MS = _RETRY_DELAY_MS;
export const AI_PARSE_DIAGNOSTICS_CONTRACT_VERSION = 'classification.ai_parse_diagnostics.v1';

export function resolveRagLoopTimeout(config = {}) {
  const metadataTimeout = Number(config.policy_recheck_metadata_timeout_ms);
  const computed = Number.isFinite(metadataTimeout) ? metadataTimeout + 8000 : 10000;
  return Math.max(RAG_LOOP_MIN_TIMEOUT_MS, Math.min(RAG_LOOP_MAX_TIMEOUT_MS, computed));
}

async function withTimeoutImpl(operationOrPromise, timeoutMs, timeoutMessage = 'operation_timeout') {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    if (typeof operationOrPromise === 'function') {
      return operationOrPromise(null);
    }
    return operationOrPromise;
  }

  if (typeof operationOrPromise === 'function') {
    const controller = new OperationController({ timeout: timeoutMs, mode: 'simple' });
    try {
      return await controller.run(async (ctx) => {
        return await operationOrPromise(ctx.signal);
      }, timeoutMessage);
    } catch (error) {
      if (
        error.name === 'AbortError' ||
        error.code === 'ABORT_ERR' ||
        error.code === 'ERR_CANCELED' ||
        error.name === 'TimeoutError' ||
        error.code === 'ETIMEDOUT'
      ) {
        const timeoutError = new Error(timeoutMessage);
        timeoutError.name = 'TimeoutError';
        timeoutError.code = error.code || 'ETIMEDOUT';
        timeoutError.originalError = error;
        throw timeoutError;
      }
      throw error;
    }
  }

  let timeoutHandle = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([operationOrPromise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function withTimeout(...args) {
  return withTimeoutImpl(...args);
}

export async function sleep(ms) {
  const delayMs = Number(ms);
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }
  await sleepFor(delayMs);
}

export async function withRetryableDbConflict(operation, options = {}) {
  const maxAttempts = Math.max(1, Number(options.maxAttempts || 1));
  const baseDelayMs = Math.max(1, Number(options.baseDelayMs || 100));
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const dbError = classifyDbSqlState(error);
      const canRetry = isRetryableDbConflictError(error) && attempt < (maxAttempts - 1);

      if (!canRetry) {
        throw error;
      }

      const delayMs = Math.min(1000, baseDelayMs * Math.pow(2, attempt));
      if (typeof options.onRetry === 'function') {
        options.onRetry({
          attempt: attempt + 1,
          maxAttempts,
          delayMs,
          sqlState: dbError.sqlState,
          reasonCode: dbError.reasonCode,
        });
      }
      await sleep(delayMs);
    }

    attempt += 1;
  }

  throw lastError || new Error('db_retry_attempts_exhausted');
}

export function isAiTransientAvailabilityError(...args) {
  return _isAiTransientAvailabilityError(...args);
}

export function buildParseDiagnostics({
  mode,
  attemptCount,
  failureReason = null,
  repaired = false,
  repairAttempted = false,
  repairSucceeded = false,
  responseArtifact = null,
  repairResponseArtifact = null,
}) {
  const diagnostics = {
    contract_version: AI_PARSE_DIAGNOSTICS_CONTRACT_VERSION,
    mode,
    attempt_count: attemptCount,
    failure_reason: failureReason,
    repaired,
    repair_attempted: repairAttempted,
    repair_succeeded: repairSucceeded,
  };

  if (responseArtifact) {
    diagnostics.response_artifact = responseArtifact;
  }

  if (repairResponseArtifact) {
    diagnostics.repair_response_artifact = repairResponseArtifact;
  }

  return diagnostics;
}

export function resolveAiFailureClassification(...args) {
  return _resolveAiFailureClassification(...args);
}

export function resolveRetryReason(...args) {
  return _resolveRetryReason(...args);
}

export function buildPendingRetryResult(...args) {
  return _buildPendingRetryResult(...args);
}

export const classificationUtilsService = {
  buildParseDiagnostics,
  buildPendingRetryResult,
  isAiTransientAvailabilityError,
  resolveAiFailureClassification,
  resolveRagLoopTimeout,
  resolveRetryReason,
  sleep,
  withRetryableDbConflict,
  withTimeout,
};
