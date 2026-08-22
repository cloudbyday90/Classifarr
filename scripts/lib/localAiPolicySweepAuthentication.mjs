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

const API_KEY_EXCHANGE_ROUTE = '/api/auth/token/exchange-local-sweep';
const SCOPED_TOKEN_PREFLIGHT_ROUTE = '/api/settings/ai';
const SCOPED_TOKEN_TTL_SECONDS = 300;

function getFetch(fetchImpl) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('A fetch implementation is required for local AI policy sweep authentication.');
  }
  return fetchImpl;
}

function normalizeBaseUrl(baseUrl) {
  if (typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    throw new TypeError('The local AI policy sweep base URL must be a non-empty string.');
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (_error) {
    throw new TypeError('The local AI policy sweep base URL must be an absolute HTTP(S) URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('The local AI policy sweep base URL must use HTTP or HTTPS.');
  }

  return parsed.href.replace(/\/$/, '');
}

function requireNonEmptySecret(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} is required.`);
  }
  return value;
}

async function readJsonPayload(response) {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
}

function statusDescription(response) {
  const status = Number.isInteger(response?.status) ? response.status : null;
  const statusText = typeof response?.statusText === 'string' && response.statusText.trim()
    ? ` ${response.statusText.trim()}`
    : '';
  return status === null ? 'a network error' : `HTTP ${status}${statusText}`;
}

export class LocalAiPolicySweepHttpError extends Error {
  constructor({ method, route, response }) {
    super(`${method} ${route} failed with ${statusDescription(response)}.`);
    this.name = 'LocalAiPolicySweepHttpError';
    this.method = method;
    this.route = route;
    this.status = Number.isInteger(response?.status) ? response.status : null;
  }
}

export class LocalAiPolicySweepAuthenticationError extends Error {
  constructor(message, { stage, status = null } = {}) {
    super(message);
    this.name = 'LocalAiPolicySweepAuthenticationError';
    this.stage = stage;
    this.status = status;
  }
}

export function createLocalAiPolicySweepApiClient({ baseUrl, token, fetchImpl = globalThis.fetch }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const bearerToken = requireNonEmptySecret(token, 'A local AI policy sweep access token');
  const request = getFetch(fetchImpl);

  async function requestJsonWithResponse(route, options = {}) {
    if (typeof route !== 'string' || !route.startsWith('/')) {
      throw new TypeError('Local AI policy sweep API routes must start with "/".');
    }

    const method = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET';
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      Authorization: `Bearer ${bearerToken}`,
    };

    let response;
    try {
      response = await request(`${normalizedBaseUrl}${route}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (_error) {
      throw new LocalAiPolicySweepHttpError({ method, route, response: null });
    }

    const payload = await readJsonPayload(response);
    if (!response.ok) {
      throw new LocalAiPolicySweepHttpError({ method, route, response });
    }

    return { payload, headers: response.headers };
  }

  async function requestJson(route, options = {}) {
    const { payload } = await requestJsonWithResponse(route, options);
    return payload;
  }

  return {
    requestJson,
    requestJsonWithResponse,
  };
}

export async function loginForLocalAiPolicySweepBearer({
  baseUrl,
  username,
  password,
  fetchImpl = globalThis.fetch,
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const identifier = requireNonEmptySecret(username, 'A local AI policy sweep username');
  const credential = requireNonEmptySecret(password, 'A local AI policy sweep password');
  const request = getFetch(fetchImpl);

  let response;
  try {
    response = await request(`${normalizedBaseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier,
        password: credential,
        rememberMe: false,
      }),
    });
  } catch (_error) {
    throw new LocalAiPolicySweepAuthenticationError(
      'Password login could not reach the local Classifarr server.',
      { stage: 'password_login' },
    );
  }

  if (!response.ok) {
    throw new LocalAiPolicySweepAuthenticationError(
      `Password login failed with ${statusDescription(response)}.`,
      { stage: 'password_login', status: response.status },
    );
  }

  const token = parseAccessTokenFromSetCookie(response.headers);
  if (!token) {
    throw new LocalAiPolicySweepAuthenticationError(
      'Password login succeeded but did not return an access-token cookie.',
      { stage: 'password_login' },
    );
  }

  return token;
}

export async function exchangeApiKeyForLocalAiPolicySweepToken({
  baseUrl,
  apiKey,
  fetchImpl = globalThis.fetch,
}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const credential = requireNonEmptySecret(apiKey, 'An admin API key');
  const request = getFetch(fetchImpl);

  let response;
  try {
    response = await request(`${normalizedBaseUrl}${API_KEY_EXCHANGE_ROUTE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': credential,
      },
      body: JSON.stringify({ ttl_seconds: SCOPED_TOKEN_TTL_SECONDS }),
    });
  } catch (_error) {
    throw new LocalAiPolicySweepAuthenticationError(
      'Admin API-key exchange could not reach the local Classifarr server.',
      { stage: 'api_key_exchange' },
    );
  }

  const payload = await readJsonPayload(response);
  if (!response.ok) {
    throw new LocalAiPolicySweepAuthenticationError(
      `Admin API-key exchange failed with ${statusDescription(response)}.`,
      { stage: 'api_key_exchange', status: response.status },
    );
  }

  const token = payload?.accessToken || payload?.data?.accessToken || null;
  if (typeof token !== 'string' || token.length === 0) {
    throw new LocalAiPolicySweepAuthenticationError(
      'Admin API-key exchange succeeded but did not return a scoped access token.',
      { stage: 'api_key_exchange' },
    );
  }

  return token;
}

function parseAccessTokenFromSetCookie(headers) {
  const setCookies = typeof headers?.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [];

  const all = [...setCookies];
  const single = headers?.get?.('set-cookie');
  if (single) {
    all.push(single);
  }

  for (const raw of all) {
    const match = raw.match(/(?:^|\s|,)access_token=([^;]+)/);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

async function preflightExchangedSweepToken(api) {
  try {
    return await api.requestJsonWithResponse(SCOPED_TOKEN_PREFLIGHT_ROUTE);
  } catch (error) {
    const status = error instanceof LocalAiPolicySweepHttpError ? error.status : null;
    const statusSuffix = status === null ? '' : ` (HTTP ${status})`;
    throw new LocalAiPolicySweepAuthenticationError(
      `The exchanged scoped token was rejected by the local server during GET ${SCOPED_TOKEN_PREFLIGHT_ROUTE}${statusSuffix}. ` +
      'The credentialed exchange was not retried. Obtain a new scoped token and inspect the local server authentication logs.',
      { stage: 'scoped_token_preflight', status },
    );
  }
}

export async function createAuthenticatedLocalAiPolicySweepApi({
  baseUrl,
  token = null,
  apiKey = null,
  username = null,
  password = null,
  fetchImpl = globalThis.fetch,
}) {
  let accessToken = token;
  let authenticationMethod = 'access_token';
  let initialAiSettingsResponse = null;

  if (!accessToken && apiKey) {
    accessToken = await exchangeApiKeyForLocalAiPolicySweepToken({ baseUrl, apiKey, fetchImpl });
    authenticationMethod = 'api_key_exchange';
  }

  if (!accessToken) {
    if (!username || !password) {
      throw new LocalAiPolicySweepAuthenticationError(
        'Authentication required: provide --token, --api-key, or both --username and --password.',
        { stage: 'authentication_selection' },
      );
    }
    accessToken = await loginForLocalAiPolicySweepBearer({ baseUrl, username, password, fetchImpl });
    authenticationMethod = 'password_login';
  }

  const api = createLocalAiPolicySweepApiClient({ baseUrl, token: accessToken, fetchImpl });
  if (authenticationMethod === 'api_key_exchange') {
    initialAiSettingsResponse = await preflightExchangedSweepToken(api);
  }

  return {
    api,
    authenticationMethod,
    initialAiSettingsResponse,
  };
}
