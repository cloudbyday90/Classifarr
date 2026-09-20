/*
 * Classifarr - Copyright (C) 2024-2026 Classifarr Contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const AUTOMATIC_RECOVERY_TASK_SOURCE = 'provider_recovery';
export const AUTOMATIC_RECOVERY_BATCH_SIZE = 5;
export const AUTOMATIC_RECOVERY_MAX_RETRIES = 3;
export const AUTOMATIC_RECOVERY_COOLDOWN_MS = 15 * 60 * 1000;
export const AUTOMATIC_RECOVERY_PROOF_MAX_AGE_MS = 60 * 1000;
export const AUTOMATIC_RECOVERY_FAILURE_CODES = Object.freeze([
  'ai_connection_error', 'ai_timeout', 'ai_rate_limited',
  'ai_server_error', 'ai_gateway_error', 'ai_unavailable',
]);

export function getAutomaticRecoveryErrorCode(error) {
  const status = error?.response?.status;
  // Prefer an explicit HTTP rejection over incidental wording/network codes.
  if (Number.isInteger(status) && status >= 400) {
    return ({ 429: 'ai_rate_limited', 500: 'ai_server_error', 502: 'ai_gateway_error',
      503: 'ai_unavailable', 504: 'ai_gateway_error' })[status] || null;
  }
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code)) return 'ai_connection_error';
  if (['ETIMEDOUT', 'ECONNABORTED'].includes(code)) return 'ai_timeout';
  return null;
}

export function getAutomaticRecoveryFailureCode(result) {
  return result?.needs_retry === true && result.method === 'queued_for_retry' &&
    AUTOMATIC_RECOVERY_FAILURE_CODES.includes(result.retry_failure_code)
    ? result.retry_failure_code : null;
}

export function isAutomaticRecoveryDue(row, now = Date.now()) {
  const exhaustedAt = row?.retry_exhausted_at == null
    ? NaN : new Date(row.retry_exhausted_at).getTime();
  return row?.retry_recovery_attempts === 0 &&
    AUTOMATIC_RECOVERY_FAILURE_CODES.includes(row.retry_failure_code) &&
    Number.isFinite(exhaustedAt) && now - exhaustedAt >= AUTOMATIC_RECOVERY_COOLDOWN_MS;
}
