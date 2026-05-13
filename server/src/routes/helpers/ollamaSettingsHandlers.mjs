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
  sendOllamaSettingsErrorResponse,
} from './ollamaSettingsSupport.mjs';
import { runSettingsRuntimeRefresh } from './settingsRuntimeRefreshSupport.mjs';
import { createSettingsServiceError } from '../../services/shared/settingsServiceErrors.mjs';

export function createOllamaSettingsHandlers({ db, ollamaService, logger }) {
  return {
    async getConfig(_req, res) {
      try {
        const result = await db.query('SELECT * FROM ollama_config WHERE is_active = true LIMIT 1');
        return res.json(result.rows[0] || null);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async updateConfig(req, res) {
      try {
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

        return res.json(result.rows[0]);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async testConnection(req, res) {
      try {
        const { host, port, model } = req.body;
        const result = await ollamaService.preflightConnection({
          host,
          port,
          model,
          probeGeneration: false,
          force: true,
        });
        return res.json(result);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async getLastPreflight(_req, res) {
      try {
        return res.json(ollamaService.getLastScheduledPreflight());
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async warmModel(req, res) {
      try {
        const { model, keepAlive = '24h' } = req.body;
        const result = await ollamaService.warmModel(model, keepAlive);
        return res.json(result);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async warmAllModels(req, res) {
      try {
        const { keepAlive = '24h' } = req.body;
        const result = await ollamaService.warmAllModels(keepAlive);
        return res.json(result);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async getModels(req, res) {
      try {
        const { host, port } = req.query;
        const models = await ollamaService.getModels(host, port);
        return res.json(models);
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },

    async getRecommendedModels(_req, res) {
      try {
        return res.json(ollamaService.getRecommendedModels());
      } catch (error) {
        return sendOllamaSettingsErrorResponse(res, error);
      }
    },
  };
}


