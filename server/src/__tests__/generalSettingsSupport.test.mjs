/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, jest, test } from '@jest/globals';
import {
  buildAllSettingsResponse,
  buildCategorySettingsResponse,
  buildCategorySettingsUpdateEntries,
  buildGeneralSettingsUpdateEntries,
  buildInvalidGeneralSettingsCategoryResponse,
  buildInvalidGeneralSettingsObjectResponse,
  coerceCategorySettingValue,
  normalizeGeneralSettingsCategory,
  normalizeGeneralSettingsUpdateRequest,
  sendGeneralSettingsErrorResponse,
} from '../routes/helpers/generalSettingsSupport.mjs';

describe('generalSettingsSupport', () => {
  test('builds the invalid object validation response', () => {
    expect(buildInvalidGeneralSettingsObjectResponse()).toEqual({
      status: 400,
      body: { error: 'Settings must be a valid object' },
    });
  });

  test('builds the invalid category validation response', () => {
    expect(buildInvalidGeneralSettingsCategoryResponse()).toEqual({
      status: 400,
      body: { error: 'Invalid category. Valid categories: queue, scheduler, classification' },
    });
  });

  test('normalizes general settings update requests', () => {
    expect(normalizeGeneralSettingsUpdateRequest({ worker_enabled: 'true' })).toEqual({
      payload: { worker_enabled: 'true' },
    });
    expect(normalizeGeneralSettingsUpdateRequest(['bad'])).toEqual({
      errorResponse: buildInvalidGeneralSettingsObjectResponse(),
    });
  });

  test('normalizes valid general settings categories', () => {
    expect(normalizeGeneralSettingsCategory('queue')).toEqual({
      payload: { category: 'queue' },
    });
    expect(normalizeGeneralSettingsCategory('bad')).toEqual({
      errorResponse: buildInvalidGeneralSettingsCategoryResponse(),
    });
  });

  test('builds general settings read payloads from settings rows', () => {
    expect(buildAllSettingsResponse([
      { key: 'worker_enabled', value: 'true' },
      { key: 'max_retry_attempts', value: '5' },
    ])).toEqual({
      worker_enabled: 'true',
      max_retry_attempts: '5',
    });
  });

  test('coerces queue category setting values and applies defaults', () => {
    expect(coerceCategorySettingValue('queue', 'workerEnabled', 'false')).toBe(false);
    expect(coerceCategorySettingValue('queue', 'concurrentWorkers', '3')).toBe(3);
    expect(coerceCategorySettingValue('queue', 'ignoredSetting', 'skip')).toBeUndefined();

    expect(buildCategorySettingsResponse('queue', [
      { key: 'queue_worker_enabled', value: 'false' },
      { key: 'queue_concurrent_workers', value: '3' },
      { key: 'queue_retry_strategy', value: 'linear' },
      { key: 'queue_unknown_setting', value: 'ignored' },
    ])).toEqual({
      workerEnabled: false,
      concurrentWorkers: 3,
      maxRetryAttempts: 5,
      retryStrategy: 'linear',
      autoDeleteCompleted: '7d',
      autoDeleteFailed: 'never',
    });
  });

  test('builds raw and category-specific settings update entries', () => {
    expect(buildGeneralSettingsUpdateEntries({ worker_enabled: 'true' })).toEqual([
      { key: 'worker_enabled', value: 'true' },
    ]);

    expect(buildCategorySettingsUpdateEntries('queue', {
      workerEnabled: true,
      retryStrategy: 'linear',
      ignoredKey: 'skip-me',
      nestedValue: { foo: 'bar' },
    })).toEqual([
      { fullKey: 'queue_worker_enabled', serializedValue: 'true' },
      { fullKey: 'queue_retry_strategy', serializedValue: 'linear' },
    ]);

    expect(buildCategorySettingsUpdateEntries('classification', {
      nestedValue: { foo: 'bar' },
    })).toEqual([
      { fullKey: 'classification_nested_value', serializedValue: '{"foo":"bar"}' },
    ]);
  });

  test('applies the shared general-settings error response shape', () => {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    sendGeneralSettingsErrorResponse(res, new Error('general settings failed'));

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'general settings failed' });
  });
});
