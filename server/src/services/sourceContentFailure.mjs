/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { catalogRetryAfter } from './libraryCatalogRetryAfter.mjs';
const networkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT']);
const reasons = new Set(['unreachable', 'timeout', 'rate_limited', 'provider_unavailable']);

/** Only transport-wide evidence may pause other libraries. Never inspect error text. */
export function sourceContentFailure(error) {
  if (reasons.has(error?.sourceContentFailure?.reason)) return {
    reason: error.sourceContentFailure.reason,
    retryAfter: catalogRetryAfter({ catalogRetryAfter: error.sourceContentFailure.retryAfter }),
  };
  const status = error?.response?.status;
  const reason = status === 429 ? 'rate_limited' : [502, 503, 504].includes(status) ? 'provider_unavailable'
    : status ? null : error?.code === 'ETIMEDOUT' || error?.name === 'TimeoutError' ? 'timeout'
      : networkCodes.has(error?.code) ? 'unreachable' : null;
  return reason ? { reason, retryAfter: catalogRetryAfter(error) } : null;
}

/** Preserve safe transport evidence through ordinary page-adapter error wrapping. */
export function sourceContentPageError(error, message) {
  return Object.assign(new Error(message), { sourceContentFailure: sourceContentFailure(error) });
}

export class SourceContentDeferredError extends Error {
  constructor(reason = 'source_content_cooldown', retryAt = null) {
    super('Media server content recovery is pending; existing inventory is preserved.');
    this.name = 'SourceContentDeferredError';
    this.reason = reason;
    this.retryAt = retryAt;
  }
}
