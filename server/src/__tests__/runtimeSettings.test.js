/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

describe('runtimeSettings', () => {
  let db;
  let runtimeSettings;
  let runtimeFile;
  let runtimeDir;
  const originalEnv = {
    RUNTIME_SETTINGS_FILE: process.env.RUNTIME_SETTINGS_FILE,
    FORCE_SECURE_COOKIES: process.env.FORCE_SECURE_COOKIES,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    OMDB_RETRY_TIMEOUT_MULTIPLIER: process.env.OMDB_RETRY_TIMEOUT_MULTIPLIER,
  };

  beforeEach(() => {
    jest.resetModules();
    db = require('../config/database');
    db.query.mockReset();

    runtimeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'classifarr-runtime-settings-'));
    runtimeFile = path.join(runtimeDir, 'runtime.json');
    process.env.RUNTIME_SETTINGS_FILE = runtimeFile;
    process.env.FORCE_SECURE_COOKIES = 'true';
    process.env.CORS_ORIGIN = ' https://example.com, https://app.local ';
    process.env.OMDB_RETRY_TIMEOUT_MULTIPLIER = '4.5';

    runtimeSettings = require('../config/runtimeSettings');
  });

  afterEach(() => {
    if (runtimeDir && fs.existsSync(runtimeDir)) {
      fs.rmSync(runtimeDir, { recursive: true, force: true });
    }
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  });

  test('returns coerced env/default values when no file or database overrides exist', () => {
    expect(runtimeSettings.getValue('force_secure_cookies')).toBe(false);
    expect(runtimeSettings.getValue('omdb_retry_timeout_multiplier')).toBe(2);
    expect(runtimeSettings.getCorsOriginsList()).toEqual([]);
    expect(runtimeSettings.getValue('missing_key')).toBeUndefined();
  });

  test('creates runtime settings file with defaults and can rewrite/reload settings', () => {
    runtimeSettings.ensureRuntimeSettingsFile();

    expect(fs.existsSync(runtimeFile)).toBe(true);
    const initial = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
    expect(initial.force_secure_cookies).toBe(false);

    runtimeSettings.writeRuntimeSettingsFile({
      ...initial,
      cors_origin: 'https://override.local'
    });

    expect(runtimeSettings.getCorsOriginsList()).toEqual(['https://override.local']);
    expect(runtimeSettings.getRuntimeSettingsFilePath()).toBe(runtimeFile);
  });

  test('refreshFromDatabase overrides file/env settings and falls back safely on failure', async () => {
    runtimeSettings.writeRuntimeSettingsFile({
      force_secure_cookies: false,
      cors_origin: null,
      omdb_request_timeout_ms: 30000,
      omdb_retry_timeout_multiplier: 2,
      omdb_max_request_timeout_ms: 60000,
      omdb_max_retries: 3,
      omdb_ssl_warn_throttle_ms: 1000
    });

    db.query
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({
        rows: [
          { key: 'cors_origin', value: 'https://db.local' }
        ]
      });

    await runtimeSettings.refreshFromDatabase();

    expect(runtimeSettings.getCorsOriginsList()).toEqual(['https://db.local']);

    db.query.mockRejectedValueOnce(new Error('settings unavailable'));
    await runtimeSettings.refreshFromDatabase();

    expect(runtimeSettings.getValue('force_secure_cookies')).toBe(false);
  });

  test('getEffectiveSettings and OMDb config coerce invalid values back to safe defaults', () => {
    runtimeSettings.writeRuntimeSettingsFile({
      force_secure_cookies: 'not-bool',
      cors_origin: '',
      omdb_request_timeout_ms: 0,
      omdb_retry_timeout_multiplier: 0.5,
      omdb_max_request_timeout_ms: 1000,
      omdb_max_retries: 0,
      omdb_ssl_warn_throttle_ms: 0
    });

    const effective = runtimeSettings.getEffectiveSettings();
    expect(effective.force_secure_cookies).toBe(false);
    expect(effective.cors_origin).toBeNull();

    expect(runtimeSettings.getOmdbRuntimeConfig()).toEqual({
      requestTimeoutMs: 30000,
      retryTimeoutMultiplier: 2,
      maxRequestTimeoutMs: 30000,
      maxRetries: 3,
      sslWarnThrottleMs: 15 * 60 * 1000
    });
  });

  test('refreshFromDatabase resets to non-db sources when settings table is absent', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ exists: false }] });

    await runtimeSettings.refreshFromDatabase();

    expect(runtimeSettings.getValue('force_secure_cookies')).toBe(false);
  });

  test('coerces numeric booleans and trims string values from runtime file payloads', () => {
    runtimeSettings.writeRuntimeSettingsFile({
      force_secure_cookies: 1,
      cors_origin: ' https://trimmed.local ',
      omdb_request_timeout_ms: '45000',
      omdb_retry_timeout_multiplier: '5',
      omdb_max_request_timeout_ms: '90000',
      omdb_max_retries: '4',
      omdb_ssl_warn_throttle_ms: '120000'
    });

    expect(runtimeSettings.getValue('force_secure_cookies')).toBe(true);
    expect(runtimeSettings.getCorsOriginsList()).toEqual(['https://trimmed.local']);
    expect(runtimeSettings.getOmdbRuntimeConfig()).toEqual({
      requestTimeoutMs: 45000,
      retryTimeoutMultiplier: 5,
      maxRequestTimeoutMs: 90000,
      maxRetries: 4,
      sslWarnThrottleMs: 120000
    });
  });

  test('reloadRuntimeFile tolerates empty and non-object JSON payloads', () => {
    fs.writeFileSync(runtimeFile, '   ', 'utf8');
    runtimeSettings.reloadRuntimeFile();
    expect(typeof runtimeSettings.getValue('force_secure_cookies')).toBe('boolean');
    expect(runtimeSettings.getEffectiveSettings()).toEqual(expect.objectContaining({
      force_secure_cookies: expect.any(Boolean)
    }));

    fs.writeFileSync(runtimeFile, '[]', 'utf8');
    runtimeSettings.reloadRuntimeFile();
    expect(typeof runtimeSettings.getValue('force_secure_cookies')).toBe('boolean');
    expect(runtimeSettings.getEffectiveSettings()).toEqual(expect.objectContaining({
      force_secure_cookies: expect.any(Boolean)
    }));
  });
});
