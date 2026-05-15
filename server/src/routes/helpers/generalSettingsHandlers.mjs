/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  buildAllSettingsResponse,
  buildCategorySettingsResponse,
  buildCategorySettingsUpdateEntries,
  buildGeneralSettingsUpdateEntries,
  normalizeGeneralSettingsCategory,
  normalizeGeneralSettingsUpdateRequest,
} from './generalSettingsSupport.mjs';

export function createGeneralSettingsHandlers({ db, runtimeSettings }) {
  return {
    async getAllSettings(_req, res, next) {
      try {
        const result = await db.query('SELECT * FROM settings ORDER BY key');
        return res.json(buildAllSettingsResponse(result.rows));
      } catch (error) {
        next(error);
      }
    },

    async updateAllSettings(req, res, next) {
      try {
        const normalizedRequest = normalizeGeneralSettingsUpdateRequest(req.body);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const updateEntries = buildGeneralSettingsUpdateEntries(normalizedRequest.payload);

        await db.withTransaction(async (client) => {
          for (const { key, value } of updateEntries) {
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
        next(error);
      }
    },

    async getCategorySettings(req, res, next) {
      try {
        const normalizedCategory = normalizeGeneralSettingsCategory(req.params.name);
        if (normalizedCategory.errorResponse) {
          return res.status(normalizedCategory.errorResponse.status).json(normalizedCategory.errorResponse.body);
        }
        const { category } = normalizedCategory.payload;

        const result = await db.query(
          'SELECT key, value FROM settings WHERE key LIKE $1 ORDER BY key',
          [`${category}_%`]
        );

        return res.json(buildCategorySettingsResponse(category, result.rows));
      } catch (error) {
        next(error);
      }
    },

    async updateCategorySettings(req, res, next) {
      try {
        const normalizedCategory = normalizeGeneralSettingsCategory(req.params.name);
        if (normalizedCategory.errorResponse) {
          return res.status(normalizedCategory.errorResponse.status).json(normalizedCategory.errorResponse.body);
        }
        const normalizedRequest = normalizeGeneralSettingsUpdateRequest(req.body);
        if (normalizedRequest.errorResponse) {
          return res.status(normalizedRequest.errorResponse.status).json(normalizedRequest.errorResponse.body);
        }

        const { category } = normalizedCategory.payload;
        const updateEntries = buildCategorySettingsUpdateEntries(category, normalizedRequest.payload);

        await db.withTransaction(async (client) => {
          for (const { fullKey, serializedValue } of updateEntries) {
            await client.query(
              `INSERT INTO settings (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
              [fullKey, serializedValue]
            );
          }
        });

        await runtimeSettings.refreshFromDatabase();
        return res.json({ success: true, category, updated: updateEntries.length });
      } catch (error) {
        next(error);
      }
    },
  };
}
