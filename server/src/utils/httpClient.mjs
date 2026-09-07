/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Thin native-fetch HTTP client.
 *
 * Design goals:
 *  • Uses Node.js 24+ built-in `fetch` by default and a matching npm Undici
 *    fetch/Agent pair for custom TLS (self-signed / verify_ssl=false scenarios).
 *  • axios-compatible response shape: `{ data, status, headers }` so callers
 *    need minimal changes.
 *  • axios-compatible error shape: `error.response?.{ status, data }` for HTTP
 *    errors; `error.code` (ECONNREFUSED, ETIMEDOUT, …) for network errors.
 *  • Native caller cancellation composed with the request deadline for buffered calls.
 *  • Optional per-request decoded response byte limits for buffered calls.
 *  • `httpGetBinary` for arraybuffer downloads (image embeddings).
 *  • `httpStream` for NDJSON/SSE streaming (ollama generate).
 *
 * Node.js version requirement: see server/package.json engines.
 * `undici` is bundled with Node.js ≥18 and accessible as an npm package.
 */

import { withBufferedHttpTransport } from './httpClientTransport.mjs';
import { createRequestCancellation } from './requestCancellation.mjs';
import { HttpResponseTooLargeError, parseHttpResponseBody, readBoundedResponseBody,
  validateResponseByteLimit } from './httpResponseBody.mjs';

/**
 * @typedef {{
 *   status: number,
 *   statusText?: string,
 *   headers?: Record<string, string>,
 *   data?: unknown,
 * }} HttpErrorResponse
 */

/**
 * @typedef {Error & {
 *   code?: string,
 *   cause?: unknown,
 *   response?: HttpErrorResponse,
 * }} HttpClientError
 */

/**
 * @typedef {{
 *   params?: Record<string, unknown>,
 *   headers?: Record<string, string>,
 *   body?: unknown,
 *   timeout?: number,
 *   signal?: AbortSignal | null,
 *   rejectUnauthorized?: boolean,
 *   maxResponseBytes?: number,
 * }} HttpRequestOptions
 */

/**
 * @typedef {{
 *   baseURL?: string,
 *   defaultHeaders?: Record<string, string>,
 *   timeout?: number,
 *   rejectUnauthorized?: boolean,
 * }} HttpClientConfig
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a native-fetch network-level failure into an axios-compatible
 * error shape.  Node.js 24+ undici propagates the POSIX error code as
 * `cause.cause.code` (e.g. ECONNREFUSED, ENOTFOUND, ECONNRESET).
 * AbortSignal.timeout() raises DOMException { name: 'TimeoutError' }.
 *
 * @param {Error & { code?: string, cause?: { code?: string } }} cause
 * @returns {HttpClientError}
 */
function normalizeNetworkError(cause) {
  const err = /** @type {HttpClientError} */ (new Error(cause.message));
  if (cause.name === 'TimeoutError') {
    err.code = 'ETIMEDOUT';
  } else if (cause.name === 'AbortError') {
    err.name = 'AbortError';
    err.code = 'ABORT_ERR';
  } else {
    // undici wraps the low-level socket error as cause.cause
    err.code = cause.cause?.code ?? cause.code ?? cause.name ?? 'ERR_NETWORK';
  }
  err.cause = cause;
  return err;
}

/** Serialize query-string params the same way axios does (skip nulls). */
function buildSearchParams(params) {
  if (!params) return '';
  const entries = Object.entries(params).filter(([, v]) => v != null);
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

/**
 * Create an HTTP error whose shape matches what axios throws for 4xx/5xx,
 * so all existing `error.response?.status` / `error.response?.data` code
 * continues to work without changes.
 *
 * @param {Response} response
 * @param {unknown} data
 * @returns {HttpClientError}
 */
function createHttpError(response, data) {
  const err = /** @type {HttpClientError} */ (new Error(`Request failed with status code ${response.status}`));
  err.response = {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    data,
  };
  return err;
}

/** Core request function used by all exported helpers. */
async function request(method, url, {
  params,
  headers = {},
  body,
  timeout = 30_000,
  signal,
  rejectUnauthorized = true,
  maxResponseBytes,
} = /** @type {HttpRequestOptions} */ ({})) {
  if (maxResponseBytes !== undefined) validateResponseByteLimit(maxResponseBytes);
  const cancellation = createRequestCancellation(timeout, signal);
  const fullUrl = `${url}${buildSearchParams(params)}`;

  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    signal: cancellation.signal,
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  cancellation.throwIfAborted();

  return withBufferedHttpTransport(rejectUnauthorized, async (fetchRequest, dispatcher) => {
    if (dispatcher) init.dispatcher = dispatcher;
    let response;
    try {
      response = await fetchRequest(fullUrl, init);
    } catch (cause) {
      cancellation.throwIfAborted();
      throw normalizeNetworkError(cause);
    }

    let data;
    try {
      data = await parseHttpResponseBody(response, maxResponseBytes);
    } catch (cause) {
      if (cause instanceof HttpResponseTooLargeError) throw cause;
      cancellation.throwIfAborted();
      throw normalizeNetworkError(cause);
    }
    cancellation.throwIfAborted();

    if (!response.ok) {
      throw createHttpError(response, data);
    }

    return { data, status: response.status, headers: Object.fromEntries(response.headers.entries()) };
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** GET request. Returns `{ data, status, headers }`. */
export async function httpGet(url, options = {}) {
  return request('GET', url, options);
}

/** POST request with JSON body. Returns `{ data, status, headers }`. */
export async function httpPost(url, body, options = {}) {
  return request('POST', url, { ...options, body });
}

/** PUT request with JSON body. Returns `{ data, status, headers }`. */
export async function httpPut(url, body, options = {}) {
  return request('PUT', url, { ...options, body });
}

/** DELETE request. Returns `{ data, status, headers }`. */
export async function httpDelete(url, options = {}) {
  return request('DELETE', url, options);
}

/**
 * Fetch a URL as a `Buffer` (binary download).
 * Used for image embeddings where the response is an image file.
 *
 * @param {string} url
 * @param {{ timeout?: number, headers?: Record<string, string>, maxBytes?: number, signal?: AbortSignal | null }} options
 * @returns {Promise<Buffer>}
 */
export async function httpGetBinary(url, { timeout = 30_000, headers = {}, maxBytes, signal } = {}) {
  if (maxBytes !== undefined) validateResponseByteLimit(maxBytes);
  const cancellation = createRequestCancellation(timeout, signal);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: cancellation.signal,
    });
  } catch (cause) {
    cancellation.throwIfAborted();
    throw normalizeNetworkError(cause);
  }

  if (!response.ok) {
    if (response.body) await Promise.allSettled([response.body.cancel()]);
    cancellation.throwIfAborted();
    throw createHttpError(response, null);
  }

  try {
    const data = maxBytes === undefined
      ? Buffer.from(await response.arrayBuffer())
      : await readBoundedResponseBody(response, maxBytes);
    cancellation.throwIfAborted();
    return data;
  } catch (cause) {
    if (cause instanceof HttpResponseTooLargeError) throw cause;
    cancellation.throwIfAborted();
    throw normalizeNetworkError(cause);
  }
}

/**
 * POST for streaming responses (Ollama /api/generate with stream:true).
 * Returns the raw `Response` object; callers read `response.body` via
 * `for await (const chunk of response.body)`.
 *
 * The caller's AbortSignal is passed directly so the stream respects
 * the OperationController timeout / stall detection.
 *
 * @param {string} url
 * @param {unknown} body  JSON-serialisable request body
 * @param {{ headers?: Record<string, string>, timeout?: number, signal?: AbortSignal }} options
 * @returns {Promise<Response>}
 */
export async function httpStream(url, body, { headers = {}, timeout = 120_000, signal } = {}) {
  const init = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(timeout),
  };

  let response;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw normalizeNetworkError(cause);
  }

  if (!response.ok) {
    const data = await parseHttpResponseBody(response);
    throw createHttpError(response, data);
  }

  return response;
}


/**
 * A stateless module-level HTTP client with no base URL.
 * Used as the default `httpClient` parameter in `settingsRouteDependencies`
 * and other places that need an injectable but ad-hoc HTTP object.
 */
export const defaultHttpClient = {
  get:    (url, options)       => httpGet(url, options),
  post:   (url, body, options) => httpPost(url, body, options),
  put:    (url, body, options) => httpPut(url, body, options),
  delete: (url, options)       => httpDelete(url, options),
};
