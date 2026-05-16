/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { ValidationError } from '../../utils/appError.mjs';
import { sendData, sendSuccess } from '../../utils/responseHelpers.mjs';
import {
  buildAllSettingsResponse,
  buildCategorySettingsResponse,
  buildCategorySettingsUpdateEntries,
  buildGeneralSettingsUpdateEntries,
  normalizeGeneralSettingsCategory,
  normalizeGeneralSettingsUpdateRequest,
} from './generalSettingsSupport.mjs';

function requireGeneralSettingsUpdateBody(body) {
  const normalizedRequest = normalizeGeneralSettingsUpdateRequest(body);
  if (normalizedRequest.errorResponse) {
    throw new ValidationError(normalizedRequest.errorResponse.body.error);
  }

  return normalizedRequest.payload;
}

function requireGeneralSettingsCategory(rawCategory) {
  const normalizedCategory = normalizeGeneralSettingsCategory(rawCategory);
  if (normalizedCategory.errorResponse) {
    throw new ValidationError(normalizedCategory.errorResponse.body.error);
  }

  return normalizedCategory.payload.category;
}

export function createGeneralSettingsHandlers({ db, runtimeSettings }) {
  return {
    getAllSettings: asyncHandler(async (_req, res) => {
      const result = await db.query('SELECT * FROM settings ORDER BY key');
      return sendData(res, buildAllSettingsResponse(result.rows));
    }),

    updateAllSettings: asyncHandler(async (req, res) => {
      const payload = requireGeneralSettingsUpdateBody(req.body);
      const updateEntries = buildGeneralSettingsUpdateEntries(payload);

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
      return sendSuccess(res);
    }),

    getCategorySettings: asyncHandler(async (req, res) => {
      const category = requireGeneralSettingsCategory(req.params.name);

      const result = await db.query(
        'SELECT key, value FROM settings WHERE key LIKE $1 ORDER BY key',
        [`${category}_%`]
      );

      return sendData(res, buildCategorySettingsResponse(category, result.rows));
    }),

    updateCategorySettings: asyncHandler(async (req, res) => {
      const category = requireGeneralSettingsCategory(req.params.name);
      const payload = requireGeneralSettingsUpdateBody(req.body);
      const updateEntries = buildCategorySettingsUpdateEntries(category, payload);

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
      return sendSuccess(res, { category, updated: updateEntries.length });
    }),
  };
}
