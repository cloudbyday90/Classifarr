/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const VALID_CATEGORIES = Object.freeze(['queue', 'scheduler', 'classification']);
const QUEUE_ALLOWED_KEYS = new Set([
  'workerEnabled',
  'concurrentWorkers',
  'maxRetryAttempts',
  'retryStrategy',
  'autoDeleteCompleted',
  'autoDeleteFailed',
  'activityRefreshInterval',
]);
const QUEUE_BOOLEAN_KEYS = new Set(['workerEnabled']);
const QUEUE_INTEGER_KEYS = new Set(['concurrentWorkers', 'maxRetryAttempts', 'activityRefreshInterval']);

import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
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

function applyCategoryDefaults(category, settings) {
  if (category !== 'queue') {
    return settings;
  }

  return {
    ...settings,
    workerEnabled: settings.workerEnabled ?? true,
    concurrentWorkers: settings.concurrentWorkers ?? 1,
    maxRetryAttempts: settings.maxRetryAttempts ?? 5,
    retryStrategy: settings.retryStrategy ?? 'exponential',
    autoDeleteCompleted: settings.autoDeleteCompleted ?? '7d',
    autoDeleteFailed: settings.autoDeleteFailed ?? 'never',
  };
}

export function createGeneralSettingsHandlers({ db, runtimeSettings }) {
  return {
    async getAllSettings(_req, res) {
      try {
        const result = await db.query('SELECT * FROM settings ORDER BY key');
        const settings = {};
        result.rows.forEach((row) => {
          settings[row.key] = row.value;
        });

        return res.json(settings);
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async updateAllSettings(req, res) {
      try {
        const settings = req.body;
        if (!isPlainObject(settings)) {
          return res.status(400).json({ error: 'Settings must be a valid object' });
        }

        await db.withTransaction(async (client) => {
          for (const [key, value] of Object.entries(settings)) {
            await client.query(
              `INSERT INTO settings (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
              [key, value]
            );
          }
        });

        await runtimeSettings.refreshFromDatabase();
        return res.json({ success: true });
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async getCategorySettings(req, res) {
      try {
        const category = req.params.name;
        if (!VALID_CATEGORIES.includes(category)) {
          return res.status(400).json({ error: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}` });
        }

        const result = await db.query(
          'SELECT key, value FROM settings WHERE key LIKE $1 ORDER BY key',
          [`${category}_%`]
        );

        const settings = {};
        result.rows.forEach((row) => {
          const keyWithoutPrefix = row.key.replace(`${category}_`, '');
          const camelKey = keyWithoutPrefix.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
          const coercedValue = coerceCategorySettingValue(category, camelKey, row.value);
          if (coercedValue !== undefined) {
            settings[camelKey] = coercedValue;
          }
        });

        return res.json(applyCategoryDefaults(category, settings));
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },

    async updateCategorySettings(req, res) {
      try {
        const category = req.params.name;
        const settings = req.body;

        if (!VALID_CATEGORIES.includes(category)) {
          return res.status(400).json({ error: `Invalid category. Valid categories: ${VALID_CATEGORIES.join(', ')}` });
        }

        if (!isPlainObject(settings)) {
          return res.status(400).json({ error: 'Settings must be a valid object' });
        }

        let updatedCount = 0;
        await db.withTransaction(async (client) => {
          for (const [key, value] of Object.entries(settings)) {
            if (category === 'queue' && !QUEUE_ALLOWED_KEYS.has(key)) {
              continue;
            }

            const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const fullKey = `${category}_${snakeKey}`;
            const serializedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

            await client.query(
              `INSERT INTO settings (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
              [fullKey, serializedValue]
            );
            updatedCount += 1;
          }
        });

        await runtimeSettings.refreshFromDatabase();
        return res.json({ success: true, category, updated: updatedCount });
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },
  };
}

