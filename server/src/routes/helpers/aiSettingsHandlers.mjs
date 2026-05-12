/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as encryptionModule from '../../utils/encryption.mjs';
import {
  getDefaultAiSettingsConfig,
  validateAiSettingsPayloadKeys,
} from './aiSettingsHelpers.mjs';
import { persistAiSettingsConfig } from './aiSettingsPersistence.mjs';
import { resolveAiProviderRequest } from './aiSettingsRequestSupport.mjs';
import { finalizeAiSettingsResponseConfig } from './aiSettingsResponseSupport.mjs';
import { createAiSettingsReadService } from '../../services/aiSettingsReadService.mjs';

export function createAiSettingsHandlers({
  db,
  logger,
  cloudLLMService,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
  validateRagLoopConfigPayloadKeys,
  resolveRequestApiKey,
  encryptValue = encryptionModule.encryptValue,
  formatEncryptedValue = encryptionModule.formatEncryptedValue,
  parseEncryptedValue = encryptionModule.parseEncryptedValue,
  decryptValue = encryptionModule.decryptValue,
}) {
  const aiSettingsReadService = createAiSettingsReadService({
    db,
    aiRouterService,
  });

  return {
    async getConfig(_req, res) {
      try {
        const result = await db.query('SELECT * FROM ai_provider_config WHERE id = 1');

        if (result.rows.length === 0) {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig));
        }

        const config = result.rows[0];
        const { normalizedConfig } = validateAndNormalizeRagLoopConfig(config, config);
        finalizeAiSettingsResponseConfig({
          config,
          normalizedConfig,
          parseEncryptedValue,
          decryptValue,
          stripInternalState: true,
        });

        return res.json(config);
      } catch (error) {
        if (error.code === '42P01') {
          return res.json(getDefaultAiSettingsConfig(getRagLoopDefaultConfig, {
            table_not_ready: true,
          }));
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async updateConfig(req, res) {
      const ragLoopConfigKeyValidation = validateRagLoopConfigPayloadKeys(req.body || {});
      if (!ragLoopConfigKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported RAG loop configuration keys in payload. Please reload the page and try again.',
          unknown_rag_loop_config_keys: ragLoopConfigKeyValidation.unknownKeys,
          disallowed_rag_loop_override_keys: ragLoopConfigKeyValidation.disallowedKeys,
        });
      }

      const aiSettingsKeyValidation = validateAiSettingsPayloadKeys(req.body || {}, getRagLoopDefaultConfig());
      if (!aiSettingsKeyValidation.valid) {
        return res.status(400).json({
          error: 'Unsupported AI settings keys in payload. Please reload the page and try again.',
          unknown_ai_settings_keys: aiSettingsKeyValidation.unknownKeys,
        });
      }

      try {
        const config = await db.withTransaction(async (client) => {
          return persistAiSettingsConfig({
            client,
            body: req.body,
            logger,
            validateAndNormalizeRagLoopConfig,
            encryptValue,
            formatEncryptedValue,
          });
        }); // end withTransaction

        aiRouterService.clearCache();
        ollamaService.resetConfig();
        embeddingProvider.resetConfig();
        embeddingRouter.resetConfig();

        finalizeAiSettingsResponseConfig({
          config,
          parseEncryptedValue,
          decryptValue,
        });

        return res.json(config);
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ error: error.message, currentSum: error.currentSum });
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async testConnection(req, res) {
      try {
        const requestConfig = await resolveAiProviderRequest({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        });

        if (!requestConfig.api_key) {
          return res.status(400).json({ success: false, error: 'API key is required' });
        }

        const result = await cloudLLMService.testConnection(requestConfig);

        return res.json(result);
      } catch (error) {
        return res.json({ success: false, error: error.message });
      }
    },

    async getModels(req, res) {
      try {
        const requestConfig = await resolveAiProviderRequest({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        });

        if (!requestConfig.api_key) {
          return res.status(400).json({ success: false, error: 'API key is required', models: [] });
        }

        const models = await cloudLLMService.getModels(requestConfig);

        return res.json({ success: true, models });
      } catch (error) {
        return res.json({ success: false, error: error.message, models: [] });
      }
    },

    async getUsage(_req, res) {
      try {
        return res.json(await aiSettingsReadService.getUsageSummary());
      } catch (error) {
        if (error.code === '42P01') {
          return res.json(aiSettingsReadService.getUsageFallback());
        }
        return res.status(500).json({ error: error.message });
      }
    },

    async getStatus(_req, res) {
      try {
        const status = await aiSettingsReadService.getStatus();
        return res.json(status);
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },

    async resetUsage(_req, res) {
      try {
        await cloudLLMService.resetMonthlyUsage();
        return res.json({ success: true, message: 'Monthly usage reset successfully' });
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

