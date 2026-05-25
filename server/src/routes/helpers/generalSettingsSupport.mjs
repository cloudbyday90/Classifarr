/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isPlainObject } from '../../utils/stringUtils.mjs';

const VALID_CATEGORIES = Object.freeze(['queue', 'scheduler', 'classification']);
const QUEUE_ALLOWED_KEYS = new Set([
  'workerEnabled',
  'concurrentWorkers',
  'metadataEnrichmentWorkers',
  'maxRetryAttempts',
  'retryStrategy',
  'autoDeleteCompleted',
  'autoDeleteFailed',
  'activityRefreshInterval',
]);
const QUEUE_BOOLEAN_KEYS = new Set(['workerEnabled']);
const QUEUE_INTEGER_KEYS = new Set(['concurrentWorkers', 'metadataEnrichmentWorkers', 'maxRetryAttempts', 'activityRefreshInterval']);


function applyCategoryDefaults(category, settings) {
  if (category !== 'queue') {
    return settings;
  }

  return {
    ...settings,
    workerEnabled: settings.workerEnabled ?? true,
    concurrentWorkers: settings.concurrentWorkers ?? 1,
    metadataEnrichmentWorkers: settings.metadataEnrichmentWorkers ?? 5,
    maxRetryAttempts: settings.maxRetryAttempts ?? 5,
    retryStrategy: settings.retryStrategy ?? 'exponential',
    autoDeleteCompleted: settings.autoDeleteCompleted ?? '7d',
    autoDeleteFailed: settings.autoDeleteFailed ?? 'never',
  };
}

function serializeCategorySettingValue(value) {
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function buildInvalidGeneralSettingsObjectResponse() {
  return {
    status: 400,
    body: { error: 'Settings must be a valid object' },
  };
}

export function buildInvalidGeneralSettingsCategoryResponse() {
  return {
    status: 400,
    body: { error: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}` },
  };
}

export function coerceCategorySettingValue(category, key, value) {
  if (category !== 'queue') {
    return value;
  }

  if (!QUEUE_ALLOWED_KEYS.has(key)) {
    return undefined;
  }

  if (QUEUE_BOOLEAN_KEYS.has(key)) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') {
        return true;
      }
      if (normalized === 'false') {
        return false;
      }
    }
    return Boolean(value);
  }

  if (QUEUE_INTEGER_KEYS.has(key)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : value;
  }

  return value;
}

export function normalizeGeneralSettingsUpdateRequest(body) {
  if (!isPlainObject(body)) {
    return { errorResponse: buildInvalidGeneralSettingsObjectResponse() };
  }

  return { payload: body };
}

export function normalizeGeneralSettingsCategory(rawCategory) {
  if (!VALID_CATEGORIES.includes(rawCategory)) {
    return { errorResponse: buildInvalidGeneralSettingsCategoryResponse() };
  }

  return { payload: { category: rawCategory } };
}

export function buildAllSettingsResponse(rows = []) {
  const settings = {};
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export function buildGeneralSettingsUpdateEntries(settings) {
  return Object.entries(settings).map(([key, value]) => ({ key, value }));
}

export function buildCategorySettingsResponse(category, rows = []) {
  const settings = {};

  rows.forEach((row) => {
    const keyWithoutPrefix = row.key.replace(`${category}_`, '');
    const camelKey = keyWithoutPrefix.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const coercedValue = coerceCategorySettingValue(category, camelKey, row.value);
    if (coercedValue !== undefined) {
      settings[camelKey] = coercedValue;
    }
  });

  return applyCategoryDefaults(category, settings);
}

export function buildCategorySettingsUpdateEntries(category, settings) {
  return Object.entries(settings).flatMap(([key, value]) => {
    if (category === 'queue' && !QUEUE_ALLOWED_KEYS.has(key)) {
      return [];
    }

    const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    return [{
      fullKey: `${category}_${snakeKey}`,
      serializedValue: serializeCategorySettingValue(value),
    }];
  });
}
