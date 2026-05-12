/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { jest } from '@jest/globals';
import {
  LOG_CONFIG,
  SENSITIVE_FIELD_PATHS,
  resolveLogConfig,
} from '../../utils/logging/logConfig.mjs';

describe('LOG_CONFIG', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses safe defaults when no env vars are set', () => {
    const config = resolveLogConfig({});

    expect(config.level).toBe('info');
    expect(config.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(config.maxFiles).toBe(5);
    expect(config.maxAgeDays).toBe(7);
    expect(config.maxTotalSizeBytes).toBe(100 * 1024 * 1024);
    expect(config.compress).toBe(true);
    expect(config.logDir).toBe('/app/data/logs');
    expect(config.fileLoggingEnabled).toBe(true);
  });

  test('normalises LOG_LEVEL to lowercase', () => {
    expect(resolveLogConfig({ LOG_LEVEL: 'WARN' }).level).toBe('warn');
  });

  test('falls back to info for unknown LOG_LEVEL values', () => {
    expect(resolveLogConfig({ LOG_LEVEL: 'verbose' }).level).toBe('info');
  });

  test('disables file logging when FILE_LOGGING_ENABLED=false', () => {
    expect(resolveLogConfig({ FILE_LOGGING_ENABLED: 'false' }).fileLoggingEnabled).toBe(false);
  });

  test('disables compression when LOG_COMPRESS=false', () => {
    expect(resolveLogConfig({ LOG_COMPRESS: 'false' }).compress).toBe(false);
  });

  test('LOG_CONFIG is an immutable snapshot of the current process env', () => {
    expect(LOG_CONFIG).toEqual(resolveLogConfig(process.env));
    expect(Object.isFrozen(LOG_CONFIG)).toBe(true);
  });

  test('SENSITIVE_FIELD_PATHS is a non-empty frozen array', () => {
    expect(Array.isArray(SENSITIVE_FIELD_PATHS)).toBe(true);
    expect(SENSITIVE_FIELD_PATHS.length).toBeGreaterThan(0);
    expect(SENSITIVE_FIELD_PATHS).toContain('password');
    expect(SENSITIVE_FIELD_PATHS).toContain('token');
    expect(() => { SENSITIVE_FIELD_PATHS.push('extra'); }).toThrow();
  });
});
