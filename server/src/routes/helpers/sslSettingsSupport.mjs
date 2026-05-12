/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

export const DEFAULT_SSL_CONFIG = {
  enabled: false,
  cert_path: '',
  key_path: '',
  ca_path: '',
  force_https: false,
  hsts_enabled: false,
  hsts_max_age: 31536000,
  client_cert_required: false,
};

export async function fetchSslConfig(dbOrClient) {
  const result = await dbOrClient.query('SELECT * FROM ssl_config LIMIT 1');
  return result.rows[0] || null;
}

function parseHstsMaxAge(value, fallback = DEFAULT_SSL_CONFIG.hsts_max_age) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function resolveNullablePath(body, existing, key) {
  if (!Object.prototype.hasOwnProperty.call(body, key)) {
    return existing?.[key] ?? null;
  }

  return body[key] || null;
}

export function normalizeSslConfig(body = {}, existing = null) {
  const prior = existing || DEFAULT_SSL_CONFIG;

  return {
    enabled: body.enabled ?? prior.enabled ?? DEFAULT_SSL_CONFIG.enabled,
    cert_path: resolveNullablePath(body, existing, 'cert_path'),
    key_path: resolveNullablePath(body, existing, 'key_path'),
    ca_path: resolveNullablePath(body, existing, 'ca_path'),
    force_https: body.force_https ?? prior.force_https ?? DEFAULT_SSL_CONFIG.force_https,
    hsts_enabled: body.hsts_enabled ?? prior.hsts_enabled ?? DEFAULT_SSL_CONFIG.hsts_enabled,
    hsts_max_age: parseHstsMaxAge(body.hsts_max_age, prior.hsts_max_age ?? DEFAULT_SSL_CONFIG.hsts_max_age),
    client_cert_required: body.client_cert_required ?? prior.client_cert_required ?? DEFAULT_SSL_CONFIG.client_cert_required,
  };
}

export function presentSslConfig(config) {
  if (!config) {
    return { ...DEFAULT_SSL_CONFIG };
  }

  return {
    ...DEFAULT_SSL_CONFIG,
    ...config,
    cert_path: config.cert_path || '',
    key_path: config.key_path || '',
    ca_path: config.ca_path || '',
  };
}

export function sendSslSettingsErrorResponse(res, error) {
  const response = buildSettingsErrorResponse(error);
  return res.status(response.status).json(response.body);
}
