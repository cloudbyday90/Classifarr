/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ValidationError } from '../../utils/appError.mjs';
import { isMaskedToken, maskToken } from '../../utils/tokenMasking.mjs';

export const ALLOWED_ARR_CONFIG_TABLES = new Set(['radarr_config', 'sonarr_config']);

export function createArrConfigError(message, httpStatus) {
  const error = new Error(message);
  error.httpStatus = httpStatus;
  return error;
}

export function validateArrConfigTable(table) {
  if (!ALLOWED_ARR_CONFIG_TABLES.has(table)) {
    throw new ValidationError(`Unsupported ARR config table: ${table}`);
  }
}

export function maskArrConfigRow(row) {
  if (!row) {
    return row;
  }

  const nextRow = { ...row };
  if (nextRow.api_key) {
    nextRow.api_key = maskToken(nextRow.api_key);
  }

  return nextRow;
}

export function parseArrConfigId(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolvePort(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

export function buildArrConfigShape(body = {}, defaultPort, existing = null) {
  const protocol = body.protocol ?? existing?.protocol ?? 'http';
  const host = body.host ?? existing?.host ?? 'localhost';
  const port = resolvePort(body.port, existing?.port ?? defaultPort);
  const basePath = body.base_path ?? existing?.base_path ?? '';
  const url = body.url || `${protocol}://${host}:${port}${basePath}`;

  return {
    protocol,
    host,
    port,
    base_path: basePath,
    url,
  };
}

export function buildArrCreatePayload({
  body,
  defaultPort,
  createDefaults = {},
  extraColumns = [],
}) {
  const shape = buildArrConfigShape(body, defaultPort);
  const payload = {
    name: body.name,
    url: shape.url,
    api_key: body.api_key,
    protocol: shape.protocol,
    host: shape.host,
    port: shape.port,
    base_path: shape.base_path,
    verify_ssl: body.verify_ssl !== false,
    timeout: body.timeout || 30,
  };

  for (const column of extraColumns) {
    payload[column] = body[column] ?? createDefaults[column] ?? null;
  }

  return payload;
}

export function buildArrUpdatePayload({
  body,
  existing,
  defaultPort,
  extraColumns = [],
}) {
  const shape = buildArrConfigShape(body, defaultPort, existing);
  const resolvedApiKey = (body.api_key && !isMaskedToken(body.api_key))
    ? body.api_key
    : existing.api_key;

  const payload = {
    name: body.name ?? existing.name,
    url: shape.url,
    api_key: resolvedApiKey,
    protocol: shape.protocol,
    host: shape.host,
    port: shape.port,
    base_path: shape.base_path,
    verify_ssl: body.verify_ssl ?? existing.verify_ssl,
    timeout: body.timeout ?? existing.timeout,
    is_active: body.is_active ?? existing.is_active,
  };

  for (const column of extraColumns) {
    payload[column] = Object.prototype.hasOwnProperty.call(body, column)
      ? body[column]
      : existing[column];
  }

  return payload;
}
