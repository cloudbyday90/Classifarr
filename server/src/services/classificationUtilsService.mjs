/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { OperationController } from '../utils/operationController.mjs';
import {
  classifyDbSqlState,
  isRetryableDbConflictError,
} from '../utils/ragLoopHelpers.mjs';

const RAG_LOOP_MIN_TIMEOUT_MS = 1000;
const RAG_LOOP_MAX_TIMEOUT_MS = 15000;
const RETRY_DELAY_MS = 5 * 60 * 1000;
const AI_PARSE_CONTRACT_VERSION = 'phase1_v1';

function resolveRagLoopTimeout(config = {}) {
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

async function withTimeout(...args) {
  return classificationUtilsService.withTimeout(...args);
}

async function sleep(ms) {
  const delayMs = Number(ms);
  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function withRetryableDbConflict(operation, options = {}) {
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

function isAiTransientAvailabilityErrorImpl(error) {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  const status = error?.response?.status;

  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }

  if ([
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'ABORT_ERR',
    'ERR_CANCELED',
    'ESTALL',
    'EINCOMPLETE',
  ].includes(code)) {
    return true;
  }

  const patterns = [
    'timeout waiting for lock',
    'providerlock',
    'ai is not available',
    'budget exhausted',
    'connection refused',
    'connect econnrefused',
    'service unavailable',
    'temporarily unavailable',
    'is currently loading',
    'try again',
    'model is busy',
    'ollama',
    'timed out',
    'stalled',
    'aborted',
    'incomplete stream',
    'generation ended before completion signal',
    'rate limit',
    'too many requests',
    'status code 429',
    'status code 500',
    'status code 502',
    'status code 503',
    'status code 504',
  ];

  return patterns.some((pattern) => message.includes(pattern));
}

function isAiTransientAvailabilityError(...args) {
  return classificationUtilsService.isAiTransientAvailabilityError(...args);
}

function buildParseDiagnostics({
  mode,
  attemptCount,
  failureReason = null,
  repaired = false,
  repairAttempted = false,
  repairSucceeded = false,
}) {
  return {
    contract_version: AI_PARSE_CONTRACT_VERSION,
    mode,
    attempt_count: attemptCount,
    failure_reason: failureReason,
    repaired,
    repair_attempted: repairAttempted,
    repair_succeeded: repairSucceeded,
  };
}

function resolveRetryReason(error) {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';

  if (code === 'EINCOMPLETE' || message.includes('completion signal')) {
    return {
      code: 'ai_stream_incomplete',
      reason: 'AI stream ended before completion signal - queued for retry',
    };
  }

  if (code === 'ESTALL' || message.includes('stalled')) {
    return {
      code: 'ai_stream_stalled',
      reason: 'AI stream stalled during generation - queued for retry',
    };
  }

  if (code === 'ABORT_ERR' || code === 'ERR_CANCELED' || message.includes('aborted')) {
    return {
      code: 'ai_stream_aborted',
      reason: 'AI generation aborted before completion - queued for retry',
    };
  }

  if (code === 'ETIMEDOUT' || message.includes('timed out')) {
    return {
      code: 'ai_timeout',
      reason: 'AI request timed out - queued for retry',
    };
  }

  if (message.includes('status code 429') || error?.response?.status === 429) {
    return {
      code: 'ai_rate_limited',
      reason: 'AI service rate limited (429) - queued for retry',
    };
  }

  if (message.includes('status code 500') || error?.response?.status === 500) {
    return {
      code: 'ai_server_error',
      reason: 'AI service returned server error (500) - queued for retry',
    };
  }

  if (
    message.includes('status code 502') ||
    message.includes('status code 504') ||
    error?.response?.status === 502 ||
    error?.response?.status === 504
  ) {
    return {
      code: 'ai_gateway_error',
      reason: 'AI service gateway error - queued for retry',
    };
  }

  if (message.includes('status code 503') || error?.response?.status === 503) {
    return {
      code: 'ai_unavailable',
      reason: 'AI service temporarily unavailable (503) - queued for retry',
    };
  }

  return {
    code: 'ai_temporarily_unavailable',
    reason: 'AI temporarily unavailable or busy - queued for retry',
  };
}

function buildPendingRetryResult({
  confidence = 0,
  libraries = [],
  signalContext = null,
  transientError = null,
  previousRetryCount = null,
  maxRetries = null,
}) {
  const retryReason = resolveRetryReason(transientError);
  const normalizedPreviousRetryCount =
    Number.isInteger(Number(previousRetryCount)) && Number(previousRetryCount) >= 0
      ? Number(previousRetryCount)
      : null;
  const normalizedMaxRetries =
    Number.isInteger(Number(maxRetries)) && Number(maxRetries) > 0
      ? Number(maxRetries)
      : 3;

  return {
    library: null,
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
    method: 'queued_for_retry',
    reason: retryReason.reason,
    retry_reason_code: retryReason.code,
    retry_after: new Date(Date.now() + RETRY_DELAY_MS),
    retry_count: normalizedPreviousRetryCount === null ? 0 : normalizedPreviousRetryCount + 1,
    max_retries: normalizedMaxRetries,
    libraries,
    signalContext,
    needs_retry: true,
  };
}

export {
  resolveRagLoopTimeout,
  withTimeout,
  sleep,
  withRetryableDbConflict,
  isAiTransientAvailabilityError,
  buildParseDiagnostics,
  resolveRetryReason,
  buildPendingRetryResult,
  RAG_LOOP_MIN_TIMEOUT_MS,
  RAG_LOOP_MAX_TIMEOUT_MS,
  RETRY_DELAY_MS,
  AI_PARSE_CONTRACT_VERSION,
};

const classificationUtilsService = {
  resolveRagLoopTimeout,
  withTimeout: withTimeoutImpl,
  sleep,
  withRetryableDbConflict,
  isAiTransientAvailabilityError: isAiTransientAvailabilityErrorImpl,
  buildParseDiagnostics,
  resolveRetryReason,
  buildPendingRetryResult,
  RAG_LOOP_MIN_TIMEOUT_MS,
  RAG_LOOP_MAX_TIMEOUT_MS,
  RETRY_DELAY_MS,
  AI_PARSE_CONTRACT_VERSION,
};

export default classificationUtilsService;
