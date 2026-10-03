/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
const transientCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN',
  'ETIMEDOUT', 'ERR_NETWORK', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET']);

export function parseArrRetryAfter(value, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 128) return null;
  const text = value.trim();
  if (/^\d+$/.test(text)) return Math.min(Number(text), 86401);
  const imf = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/;
  const rfc850 = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-[A-Z][a-z]{2}-\d{2} \d{2}:\d{2}:\d{2} GMT$/;
  const asctime = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} [ \d]\d \d{2}:\d{2}:\d{2} \d{4}$/;
  if (!imf.test(text) && !rfc850.test(text) && !asctime.test(text)) return null;
  // asctime has no zone; HTTP dates are always GMT, never the host's local zone.
  const date = new Date(Date.parse(asctime.test(text) ? `${text} GMT` : text));
  if (rfc850.test(text) && date.getUTCFullYear() > new Date(now).getUTCFullYear() + 50) {
    date.setUTCFullYear(date.getUTCFullYear() - 100);
  }
  const time = date.getTime();
  return Number.isFinite(time) ? Math.min(86401, Math.max(0, Math.ceil((time - now) / 1000))) : null;
}

// Deliberately exclude cause, response body, request URL and credential headers.
export class ArrLookupFailure extends Error {
  constructor(message, error) {
    super(message);
    this.name = 'ArrLookupFailure';
    const status = error?.response?.status;
    this.kind = [401, 403].includes(status) ? 'authentication'
      : [408, 429, 500, 502, 503, 504].includes(status) || transientCodes.has(error?.code)
        || error?.name === 'TimeoutError' ? 'transient' : 'configuration';
    this.retryAfterSeconds = [429, 503].includes(status)
      ? parseArrRetryAfter(error?.response?.headers?.['retry-after']) : null;
    if (this.retryAfterSeconds > 86400) this.kind = 'configuration';
  }
}

export function routingProviderFailure(error) {
  return error instanceof ArrLookupFailure
    ? { kind: error.kind, retryAfterSeconds: error.retryAfterSeconds }
    : { kind: 'transient', retryAfterSeconds: null };
}
