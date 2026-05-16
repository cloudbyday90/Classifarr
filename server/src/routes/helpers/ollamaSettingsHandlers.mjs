/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  normalizeOllamaHost,
  normalizeOllamaPort,
} from './ollamaSettingsSupport.mjs';
import { runSettingsRuntimeRefresh } from './settingsRuntimeRefreshSupport.mjs';
import { createSettingsServiceError } from '../../services/shared/settingsServiceErrors.mjs';
import { asyncHandler } from '../../utils/asyncHandler.mjs';
import { sendData } from '../../utils/responseHelpers.mjs';

export function createOllamaSettingsHandlers({ db, ollamaService, logger }) {
  return {
    getConfig: asyncHandler(async (_req, res) => {
      const result = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
      return sendData(res, result.rows[0] || null);
    }),

    updateConfig: asyncHandler(async (req, res) => {
      const { host, port, model, temperature } = req.body || {};

      const result = await db.withTransaction(async (client) => {
        const existingResult = await client.query('SELECT * FROM ollama_config WHERE is_active = true ORDER BY id ASC LIMIT 1');
        const existing = existingResult.rows[0] || null;

        const normalizedHost = normalizeOllamaHost(host);
        const normalizedPort = normalizeOllamaPort(port);
        const nextHost = normalizedHost !== undefined ? normalizedHost : existing?.host;
        const nextPort = normalizedPort !== undefined ? normalizedPort : existing?.port;
        const nextModel = model !== undefined ? model : existing?.model ?? null;
        const nextTemperature = temperature !== undefined ? temperature : existing?.temperature ?? 0.30;

        if (!nextHost) {
          throw createSettingsServiceError('Host is required', 400);
        }

        if (nextPort === null || nextPort === undefined) {
          throw createSettingsServiceError('A valid port is required', 400);
        }

        if (existing) {
          await client.query('UPDATE ollama_config SET is_active = false WHERE id <> $1 AND is_active = true', [existing.id]);
          return client.query(
            `UPDATE ollama_config
               SET host = $1,
                   port = $2,
                   model = $3,
                   temperature = $4,
                   is_active = true,
                   updated_at = NOW()
               WHERE id = $5
               RETURNING *`,
            [nextHost, nextPort, nextModel, nextTemperature, existing.id]
          );
        }

        await client.query('UPDATE ollama_config SET is_active = false WHERE is_active = true');
        return client.query(
          `INSERT INTO ollama_config (host, port, model, temperature, is_active)
             VALUES ($1, $2, $3, $4, true)
             RETURNING *`,
          [nextHost, nextPort, nextModel, nextTemperature]
        );
      });

      runSettingsRuntimeRefresh({
        context: 'ollama-settings',
        logger,
        actions: [
          { label: 'ollama-config', run: () => ollamaService.resetConfig() },
        ],
      });

      return sendData(res, result.rows[0]);
    }),

    testConnection: asyncHandler(async (req, res) => {
      const { host, port, model } = req.body;
      const result = await ollamaService.preflightConnection({
        host,
        port,
        model,
        probeGeneration: false,
        force: true,
      });
      return sendData(res, result);
    }),

    getLastPreflight: asyncHandler(async (_req, res) => sendData(res, ollamaService.getLastScheduledPreflight())),

    warmModel: asyncHandler(async (req, res) => {
      const { model, keepAlive = '24h' } = req.body;
      const result = await ollamaService.warmModel(model, keepAlive);
      return sendData(res, result);
    }),

    warmAllModels: asyncHandler(async (req, res) => {
      const { keepAlive = '24h' } = req.body;
      const result = await ollamaService.warmAllModels(keepAlive);
      return sendData(res, result);
    }),

    getModels: asyncHandler(async (req, res) => {
      const { host, port } = req.query;
      const models = await ollamaService.getModels(host, port);
      return sendData(res, models);
    }),

    getRecommendedModels: asyncHandler(async (_req, res) => sendData(res, ollamaService.getRecommendedModels())),
  };
}
