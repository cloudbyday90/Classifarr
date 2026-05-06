/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// logConfig.mjs
// ---------------------------------------------------------------------------

describe('LOG_CONFIG', () => {
  // Each test block reimports the module after manipulating process.env to
  // verify env-driven config resolution.  Because Jest caches module imports,
  // we use jest.resetModules() + dynamic import for isolation.

  beforeEach(() => {
    jest.resetModules();
  });

  test('uses safe defaults when no env vars are set', async () => {
    const saved = {
      LOG_LEVEL: process.env.LOG_LEVEL,
      LOG_MAX_FILE_SIZE: process.env.LOG_MAX_FILE_SIZE,
      LOG_MAX_FILES: process.env.LOG_MAX_FILES,
      LOG_MAX_AGE_DAYS: process.env.LOG_MAX_AGE_DAYS,
      LOG_MAX_TOTAL_SIZE: process.env.LOG_MAX_TOTAL_SIZE,
      LOG_COMPRESS: process.env.LOG_COMPRESS,
      LOG_DIR: process.env.LOG_DIR,
      FILE_LOGGING_ENABLED: process.env.FILE_LOGGING_ENABLED,
    };

    delete process.env.LOG_LEVEL;
    delete process.env.LOG_MAX_FILE_SIZE;
    delete process.env.LOG_MAX_FILES;
    delete process.env.LOG_MAX_AGE_DAYS;
    delete process.env.LOG_MAX_TOTAL_SIZE;
    delete process.env.LOG_COMPRESS;
    delete process.env.LOG_DIR;
    delete process.env.FILE_LOGGING_ENABLED;

    const { LOG_CONFIG } = await import('../../utils/logging/logConfig.mjs');

    expect(LOG_CONFIG.level).toBe('info');
    expect(LOG_CONFIG.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(LOG_CONFIG.maxFiles).toBe(5);
    expect(LOG_CONFIG.maxAgeDays).toBe(7);
    expect(LOG_CONFIG.maxTotalSizeBytes).toBe(100 * 1024 * 1024);
    expect(LOG_CONFIG.compress).toBe(true);
    expect(LOG_CONFIG.logDir).toBe('/app/data/logs');
    expect(LOG_CONFIG.fileLoggingEnabled).toBe(true);

    // Restore
    for (const [k, v] of Object.entries(saved)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  });

  test('normalises LOG_LEVEL to lowercase', async () => {
    process.env.LOG_LEVEL = 'WARN';
    const { LOG_CONFIG } = await import('../../utils/logging/logConfig.mjs');
    expect(LOG_CONFIG.level).toBe('warn');
    delete process.env.LOG_LEVEL;
  });

  test('falls back to info for unknown LOG_LEVEL values', async () => {
    process.env.LOG_LEVEL = 'verbose';
    const { LOG_CONFIG } = await import('../../utils/logging/logConfig.mjs');
    expect(LOG_CONFIG.level).toBe('info');
    delete process.env.LOG_LEVEL;
  });

  test('disables file logging when FILE_LOGGING_ENABLED=false', async () => {
    process.env.FILE_LOGGING_ENABLED = 'false';
    const { LOG_CONFIG } = await import('../../utils/logging/logConfig.mjs');
    expect(LOG_CONFIG.fileLoggingEnabled).toBe(false);
    delete process.env.FILE_LOGGING_ENABLED;
  });

  test('disables compression when LOG_COMPRESS=false', async () => {
    process.env.LOG_COMPRESS = 'false';
    const { LOG_CONFIG } = await import('../../utils/logging/logConfig.mjs');
    expect(LOG_CONFIG.compress).toBe(false);
    delete process.env.LOG_COMPRESS;
  });

  test('SENSITIVE_FIELD_PATHS is a non-empty frozen array', async () => {
    const { SENSITIVE_FIELD_PATHS } = await import('../../utils/logging/logConfig.mjs');
    expect(Array.isArray(SENSITIVE_FIELD_PATHS)).toBe(true);
    expect(SENSITIVE_FIELD_PATHS.length).toBeGreaterThan(0);
    expect(SENSITIVE_FIELD_PATHS).toContain('password');
    expect(SENSITIVE_FIELD_PATHS).toContain('token');
    expect(() => { SENSITIVE_FIELD_PATHS.push('extra'); }).toThrow();
  });
});
