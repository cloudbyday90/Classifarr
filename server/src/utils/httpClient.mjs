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
 *  • Zero npm dependencies — uses Node.js 24+ built-in `fetch` (via undici) and
 *    `undici.Agent` for custom TLS (self-signed / verify_ssl=false scenarios).
 *  • axios-compatible response shape: `{ data, status, headers }` so callers
 *    need minimal changes.
 *  • axios-compatible error shape: `error.response?.{ status, data }` for HTTP
 *    errors; `error.code` (ECONNREFUSED, ETIMEDOUT, …) for network errors.
 *  • AbortSignal.timeout() for timeouts — no need for a separate abort
 *    controller just to enforce deadlines.
 *  • `createHttpClient` factory mirrors `axios.create()` for services that need
 *    a base URL and default headers (radarr, sonarr, emby/jellyfin).
 *  • `httpGetBinary` for arraybuffer downloads (image embeddings).
 *  • `httpStream` for NDJSON/SSE streaming (ollama generate).
 *
 * Node.js version requirement: >=24.11.0 (enforced by server/package.json engines).
 * `undici` is bundled with Node.js ≥18 and accessible as an npm package.
 */

import { Agent } from 'undici';

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
 *   rejectUnauthorized?: boolean,
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

/** Parse a fetch Response body as JSON or plain text based on Content-Type. */
async function parseBody(response) {
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return response.json().catch(() => null);
  }
  return response.text();
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
  rejectUnauthorized = true,
} = /** @type {HttpRequestOptions} */ ({})) {
  const fullUrl = `${url}${buildSearchParams(params)}`;

  const init = {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  if (!rejectUnauthorized) {
    init.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
  }

  let response;
  try {
    response = await fetch(fullUrl, init);
  } catch (cause) {
    throw normalizeNetworkError(cause);
  }

  const data = await parseBody(response);

  if (!response.ok) {
    throw createHttpError(response, data);
  }

  return { data, status: response.status, headers: Object.fromEntries(response.headers.entries()) };
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
 * @param {{ timeout?: number, headers?: Record<string, string>, maxBytes?: number }} options
 * @returns {Promise<Buffer>}
 */
export async function httpGetBinary(url, { timeout = 30_000, headers = {}, maxBytes } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(timeout),
    });
  } catch (cause) {
    throw normalizeNetworkError(cause);
  }

  if (!response.ok) {
    throw createHttpError(response, null);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (maxBytes !== undefined && buffer.length > maxBytes) {
    throw new Error(`Response size ${buffer.length} bytes exceeds maximum allowed ${maxBytes} bytes`);
  }

  return buffer;
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
    const data = await parseBody(response);
    throw createHttpError(response, data);
  }

  return response;
}

/**
 * Factory for a pre-configured HTTP client — mirrors `axios.create()`.
 * Used by services (radarr, sonarr, emby, jellyfin) that share a base URL,
 * default headers, and optional SSL-bypass across multiple requests.
 *
 * @param {HttpClientConfig} config
 * @returns {{ get, post, put, delete }}
 */
export function createHttpClient({
  baseURL = '',
  defaultHeaders = {},
  timeout = 30_000,
  rejectUnauthorized = true,
} = {}) {
  /** @param {HttpRequestOptions} options */
  const mergeOptions = (options = {}) => ({
    ...options,
    timeout: options.timeout ?? timeout,
    rejectUnauthorized: options.rejectUnauthorized ?? rejectUnauthorized,
    headers: { ...defaultHeaders, ...(options.headers ?? {}) },
  });

  return {
    get:    (path, options)       => httpGet(`${baseURL}${path}`, mergeOptions(options)),
    post:   (path, body, options) => httpPost(`${baseURL}${path}`, body, mergeOptions(options)),
    put:    (path, body, options) => httpPut(`${baseURL}${path}`, body, mergeOptions(options)),
    delete: (path, options)       => httpDelete(`${baseURL}${path}`, mergeOptions(options)),
  };
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
