/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
/* eslint-disable security/detect-non-literal-fs-filename -- paths come from trusted internal config, not user input */
import fs from 'node:fs';
import path from 'node:path';
import * as db from './database.mjs';
import { createLogger } from '../utils/logger.mjs';

const logger = createLogger('RuntimeSettings');

let runtimeSettingsFile = process.env.RUNTIME_SETTINGS_FILE || '/app/data/config/runtime.json';
let shouldAutogenerateRuntimeFile = fs.existsSync('/app/data');

const SETTINGS_DEFINITION = {
  force_secure_cookies: { env: 'FORCE_SECURE_COOKIES', default: false, type: 'boolean' },
  csrf_protection: { env: 'CSRF_PROTECTION', default: true, type: 'boolean' },
  cors_origin: { env: 'CORS_ORIGIN', default: null, type: 'string_or_null' },
  omdb_request_timeout_ms: { env: 'OMDB_REQUEST_TIMEOUT_MS', default: 30000, type: 'int_min_1' },
  omdb_retry_timeout_multiplier: { env: 'OMDB_RETRY_TIMEOUT_MULTIPLIER', default: 2, type: 'float_min_1' },
  omdb_max_request_timeout_ms: { env: 'OMDB_MAX_REQUEST_TIMEOUT_MS', default: 60000, type: 'int_min_1' },
  omdb_max_retries: { env: 'OMDB_MAX_RETRIES', default: 3, type: 'int_min_1' },
  omdb_ssl_warn_throttle_ms: { env: 'OMDB_SSL_WARN_THROTTLE_MS', default: 15 * 60 * 1000, type: 'int_min_1' }
};

let fileSettings = {};
let dbSettings = {};
let fileLoaded = false;
let runtimeFileInitialized = false;

function refreshRuntimeSettingsEnvironment() {
  runtimeSettingsFile = process.env.RUNTIME_SETTINGS_FILE || '/app/data/config/runtime.json';
  shouldAutogenerateRuntimeFile = fs.existsSync('/app/data');
}

function parseBoolean(value, fallback) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function parseIntMin(value, fallback, minValue) {
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed >= minValue) {
    return parsed;
  }
  return fallback;
}

function parseFloatMin(value, fallback, minValue) {
  const parsed = parseFloat(value);
  if (Number.isFinite(parsed) && parsed >= minValue) {
    return parsed;
  }
  return fallback;
}

function parseStringOrNull(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function coerceValue(value, definition) {
  switch (definition.type) {
  case 'boolean':
    return parseBoolean(value, definition.default);
  case 'int_min_1':
    return parseIntMin(value, definition.default, 1);
  case 'float_min_1':
    return parseFloatMin(value, definition.default, 1);
  case 'string_or_null':
    return parseStringOrNull(value, definition.default);
  default:
    return value;
  }
}

function readRuntimeFile() {
  try {
    if (!fs.existsSync(runtimeSettingsFile)) {
      return {};
    }

    const raw = fs.readFileSync(runtimeSettingsFile, 'utf8');
    if (!raw.trim()) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logger.warn('Runtime settings file must contain a JSON object', {
        file: runtimeSettingsFile
      });
      return {};
    }

    return parsed;
  } catch (error) {
    logger.warn('Failed to read runtime settings file; falling back to env/defaults', {
      file: runtimeSettingsFile,
      error: error.message
    });
    return {};
  }
}

function getDefaultSettingsPayload() {
  const payload = {};
  for (const [key, definition] of Object.entries(SETTINGS_DEFINITION)) {
    payload[key] = definition.default;
  }
  return payload;
}

function ensureRuntimeSettingsDirectory() {
  const dir = path.dirname(runtimeSettingsFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function ensureRuntimeSettingsFile() {
  if (runtimeFileInitialized || !shouldAutogenerateRuntimeFile) {
    return;
  }
  runtimeFileInitialized = true;

  try {
    ensureRuntimeSettingsDirectory();
    const defaults = getDefaultSettingsPayload();

    if (!fs.existsSync(runtimeSettingsFile)) {
      fs.writeFileSync(runtimeSettingsFile, JSON.stringify(defaults, null, 2), 'utf8');
      logger.info('Created runtime settings file with defaults', { file: runtimeSettingsFile });
      return;
    }

    const existing = readRuntimeFile();
    const merged = { ...defaults, ...existing };
    const missingKeys = Object.keys(defaults).filter((key) => !Object.prototype.hasOwnProperty.call(existing, key));

    if (missingKeys.length > 0) {
      fs.writeFileSync(runtimeSettingsFile, JSON.stringify(merged, null, 2), 'utf8');
      logger.info('Updated runtime settings file with new default keys', {
        file: runtimeSettingsFile,
        keysAdded: missingKeys
      });
    }
  } catch (error) {
    logger.warn('Failed to auto-generate runtime settings file', {
      file: runtimeSettingsFile,
      error: error.message
    });
  }
}

/** @internal */
export function resetRuntimeSettingsState() {
  refreshRuntimeSettingsEnvironment();
  fileSettings = {};
  dbSettings = {};
  fileLoaded = false;
  runtimeFileInitialized = false;
}

function ensureFileLoaded() {
  if (fileLoaded) return;
  ensureRuntimeSettingsFile();
  fileSettings = readRuntimeFile();
  fileLoaded = true;
}

function getRawValue(key, definition) {
  if (Object.prototype.hasOwnProperty.call(dbSettings, key)) {
    return dbSettings[key];
  }
  ensureFileLoaded();
  if (Object.prototype.hasOwnProperty.call(fileSettings, key)) {
    return fileSettings[key];
  }
  if (definition.env && Object.prototype.hasOwnProperty.call(process.env, definition.env)) {
    return process.env[definition.env];
  }
  return definition.default;
}

export function getValue(key) {
  const definition = SETTINGS_DEFINITION[key];
  if (!definition) {
    return undefined;
  }
  const raw = getRawValue(key, definition);
  return coerceValue(raw, definition);
}

/** @internal */
export function getCorsOriginsList() {
  const raw = getValue('cors_origin');
  if (!raw) {
    return [];
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export function getOmdbRuntimeConfig() {
  const requestTimeoutMs = getValue('omdb_request_timeout_ms');
  const retryTimeoutMultiplier = getValue('omdb_retry_timeout_multiplier');
  const maxRequestTimeoutMs = Math.max(requestTimeoutMs, getValue('omdb_max_request_timeout_ms'));

  return {
    requestTimeoutMs,
    retryTimeoutMultiplier,
    maxRequestTimeoutMs,
    maxRetries: getValue('omdb_max_retries'),
    sslWarnThrottleMs: getValue('omdb_ssl_warn_throttle_ms')
  };
}

export async function refreshFromDatabase() {
  try {
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'settings'
      ) AS exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      dbSettings = {};
      return;
    }

    const keys = Object.keys(SETTINGS_DEFINITION);
    const result = await db.query(
      'SELECT key, value FROM settings WHERE key = ANY($1::text[])',
      [keys]
    );

    const nextDbSettings = {};
    for (const row of result.rows) {
      nextDbSettings[row.key] = row.value;
    }
    dbSettings = nextDbSettings;
  } catch (error) {
    dbSettings = {};
    logger.warn('Failed to load runtime settings overrides from database', {
      error: error.message
    });
  }
}

export function reloadRuntimeFile() {
  ensureRuntimeSettingsFile();
  fileSettings = readRuntimeFile();
  fileLoaded = true;
}

/** @internal */
export function getRuntimeSettingsFilePath() {
  return runtimeSettingsFile;
}

/** @internal */
export function writeRuntimeSettingsFile(payload) {
  ensureRuntimeSettingsDirectory();
  fs.writeFileSync(runtimeSettingsFile, JSON.stringify(payload, null, 2), 'utf8');
  reloadRuntimeFile();
}

/** @internal */
export function getEffectiveSettings() {
  const effective = {};
  for (const key of Object.keys(SETTINGS_DEFINITION)) {
    effective[key] = getValue(key);
  }
  return effective;
}
