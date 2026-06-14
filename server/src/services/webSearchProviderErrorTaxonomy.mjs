/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const WEB_SEARCH_PROVIDER_ERROR_CODES = Object.freeze({
  AUTH_FAILED: 'auth_failed',
  FORBIDDEN: 'forbidden',
  RATE_LIMITED: 'rate_limited',
  QUOTA_EXHAUSTED: 'quota_exhausted',
  INVALID_REQUEST: 'invalid_request',
  NOT_FOUND: 'not_found',
  PROVIDER_RESPONSE_INVALID: 'provider_response_invalid',
  PROVIDER_5XX: 'provider_5xx',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  SSL_ERROR: 'ssl_error',
  UNKNOWN: 'unknown',
});

const NETWORK_ERROR_CODES = new Set([
  'ABORT_ERR',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ERR_NETWORK',
]);

const TIMEOUT_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const SSL_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

const QUOTA_MESSAGE_PATTERN = /\b(quota|credit|credits|billing|plan|monthly|usage limit|spending limit|insufficient_quota)\b/i;
const SECRET_VALUE_PATTERN = /\b(api[_-]?key|token|authorization|bearer|x-subscription-token)\b\s*[:=]\s*[^,\s]+/gi;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const DEFAULT_SAFE_MESSAGE = 'Provider request failed';

function getHeaders(error) {
  return error?.response?.headers || error?.headers || {};
}

function getHeaderValue(headers, name) {
  if (!headers || typeof headers !== 'object') return null;
  const direct = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (direct != null) return direct;

  const foundKey = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return foundKey ? headers[foundKey] : null;
}

function getHttpStatus(error) {
  const rawStatus = error?.response?.status ?? error?.status ?? error?.statusCode ?? null;
  const parsed = Number.parseInt(rawStatus, 10);
  return Number.isFinite(parsed) && parsed >= 100 && parsed <= 599 ? parsed : null;
}

function getCauseCode(error) {
  return error?.code || error?.cause?.code || error?.cause?.cause?.code || null;
}

function getProviderPayloadText(error) {
  const data = error?.response?.data;
  if (!data) return '';
  if (typeof data === 'string') return data;
  if (typeof data === 'object') {
    return [
      data.error,
      data.message,
      data.error_description,
      data.type,
      data.code,
    ].filter(Boolean).join(' ');
  }
  return '';
}

export function sanitizeProviderErrorMessage(value, fallback = DEFAULT_SAFE_MESSAGE) {
  if (!value) return fallback;
  const sanitized = String(value)
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(SECRET_VALUE_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return fallback;
  return sanitized.length > 240 ? `${sanitized.slice(0, 239).trimEnd()}…` : sanitized;
}

export function parseRetryAfterSeconds(value, now = new Date()) {
  if (value == null || value === '') return null;
  const raw = Array.isArray(value) ? value[0] : value;
  const asNumber = Number.parseInt(raw, 10);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.min(asNumber, 86_400);
  }

  const timestamp = Date.parse(String(raw));
  if (!Number.isFinite(timestamp)) return null;
  const deltaSeconds = Math.ceil((timestamp - now.getTime()) / 1000);
  if (deltaSeconds < 0) return 0;
  return Math.min(deltaSeconds, 86_400);
}

function classifyHttpStatus(status, providerText) {
  if (status === 401) return WEB_SEARCH_PROVIDER_ERROR_CODES.AUTH_FAILED;
  if (status === 402) return WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED;
  if (status === 403) {
    return QUOTA_MESSAGE_PATTERN.test(providerText)
      ? WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED
      : WEB_SEARCH_PROVIDER_ERROR_CODES.FORBIDDEN;
  }
  if (status === 404) return WEB_SEARCH_PROVIDER_ERROR_CODES.NOT_FOUND;
  if (status === 408) return WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT;
  if (status === 429) {
    return QUOTA_MESSAGE_PATTERN.test(providerText)
      ? WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED
      : WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED;
  }
  if (status === 400 || status === 422) return WEB_SEARCH_PROVIDER_ERROR_CODES.INVALID_REQUEST;
  if (status >= 500 && status <= 599) return WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX;
  if (status >= 400 && status <= 499) return WEB_SEARCH_PROVIDER_ERROR_CODES.INVALID_REQUEST;
  return null;
}

function classifyCauseCode(code) {
  if (!code) return null;
  if (TIMEOUT_ERROR_CODES.has(code)) return WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT;
  if (SSL_ERROR_CODES.has(code)) return WEB_SEARCH_PROVIDER_ERROR_CODES.SSL_ERROR;
  if (NETWORK_ERROR_CODES.has(code)) return WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR;
  return null;
}

function getRetryable(errorCode) {
  return [
    WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
    WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX,
    WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT,
    WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR,
  ].includes(errorCode);
}

function getCooldownEligible(errorCode) {
  return [
    WEB_SEARCH_PROVIDER_ERROR_CODES.RATE_LIMITED,
    WEB_SEARCH_PROVIDER_ERROR_CODES.QUOTA_EXHAUSTED,
    WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_5XX,
    WEB_SEARCH_PROVIDER_ERROR_CODES.TIMEOUT,
    WEB_SEARCH_PROVIDER_ERROR_CODES.NETWORK_ERROR,
    WEB_SEARCH_PROVIDER_ERROR_CODES.SSL_ERROR,
  ].includes(errorCode);
}

export function classifyWebSearchProviderError(error, {
  provider = 'unknown',
  operation = 'search',
  now = new Date(),
} = {}) {
  const httpStatus = getHttpStatus(error);
  const causeCode = getCauseCode(error);
  const providerText = getProviderPayloadText(error);
  const errorCode = classifyHttpStatus(httpStatus, providerText)
    || classifyCauseCode(causeCode)
    || (error?.code === 'WEB_SEARCH_PROVIDER_CONTRACT_INVALID'
      ? WEB_SEARCH_PROVIDER_ERROR_CODES.PROVIDER_RESPONSE_INVALID
      : WEB_SEARCH_PROVIDER_ERROR_CODES.UNKNOWN);
  const retryAfterSeconds = parseRetryAfterSeconds(getHeaderValue(getHeaders(error), 'retry-after'), now);
  const rawMessage = providerText || error?.message || DEFAULT_SAFE_MESSAGE;

  return Object.freeze({
    provider,
    operation,
    errorCode,
    httpStatus,
    retryable: getRetryable(errorCode),
    cooldownEligible: getCooldownEligible(errorCode),
    retryAfterSeconds,
    causeCode,
    safeMessage: sanitizeProviderErrorMessage(rawMessage),
  });
}

export class WebSearchProviderError extends Error {
  constructor(classification, cause) {
    super(classification.safeMessage);
    this.name = 'WebSearchProviderError';
    this.code = classification.errorCode;
    this.provider = classification.provider;
    this.operation = classification.operation;
    this.httpStatus = classification.httpStatus;
    this.retryable = classification.retryable;
    this.cooldownEligible = classification.cooldownEligible;
    this.retryAfterSeconds = classification.retryAfterSeconds;
    this.causeCode = classification.causeCode;
    this.cause = cause;
  }
}

export function toWebSearchProviderError(error, options = {}) {
  if (error instanceof WebSearchProviderError) return error;
  return new WebSearchProviderError(
    classifyWebSearchProviderError(error, options),
    error
  );
}
