export const RETRY_DELAY_MS = 5 * 60 * 1000;

function isAiTransientAvailabilityErrorImpl(error) {
  const message = typeof error?.message === 'string' ? error.message.toLowerCase() : '';
  const code = typeof error?.code === 'string' ? error.code.toUpperCase() : '';
  const status = error?.response?.status;

  // This is a deterministic local integrity guard, not a transient provider
  // availability failure. Retrying cannot make a changed model match the
  // tested digest and would delay its fail-closed capability revocation.
  if (code === 'MODEL_DIGEST_MISMATCH') {
    return false;
  }

  if (status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
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
    'MODEL_NOT_FOUND',
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
    'model not found',
    'model is not available',
    'is not available on',
    'ollama',
    'timed out',
    'stalled',
    'aborted',
    'incomplete stream',
    'generation ended before completion signal',
    'rate limit',
    'too many requests',
    'status code 429',
    'status code 404',
    'status code 500',
    'status code 502',
    'status code 503',
    'status code 504',
  ];

  return patterns.some((pattern) => message.includes(pattern));
}

export function isAiTransientAvailabilityError(...args) {
  return isAiTransientAvailabilityErrorImpl(...args);
}

export function resolveRetryReason(error) {
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

  if (
    code === 'MODEL_NOT_FOUND' ||
    message.includes('status code 404') ||
    message.includes('model not found') ||
    message.includes('model is not available') ||
    message.includes('is not available on') ||
    error?.response?.status === 404
  ) {
    return {
      code: 'ai_provider_not_found',
      reason: 'AI provider or model was not found - queued for retry after configuration/model availability changes',
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

function resolveAiFailureClassificationImpl(error) {
  return {
    isTransientAvailability: isAiTransientAvailabilityErrorImpl(error),
    retryReason: resolveRetryReason(error),
  };
}

export function resolveAiFailureClassification(...args) {
  return resolveAiFailureClassificationImpl(...args);
}

export function buildPendingRetryResult({
  confidence = 0,
  libraries = [],
  signalContext = null,
  transientError = null,
  previousRetryCount = null,
  maxRetries = null,
}) {
  const { retryReason } = resolveAiFailureClassification(transientError);
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
