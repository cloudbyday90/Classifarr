/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as encryptionModule from '../../utils/encryption.mjs';
import { validateAiSettingsPayloadKeys } from './aiSettingsHelpers.mjs';
import { persistAiSettingsConfig } from './aiSettingsPersistence.mjs';
import { resolveAiProviderRequest } from './aiSettingsRequestSupport.mjs';
import { finalizeAiSettingsResponseConfig } from './aiSettingsResponseSupport.mjs';
import { createAiSettingsActionService } from '../../services/aiSettingsActionService.mjs';
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
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
    finalizeAiSettingsResponseConfig,
    parseEncryptedValue,
    decryptValue,
  });
  const aiSettingsActionService = createAiSettingsActionService({
    cloudLLMService,
    resolveAiProviderRequest,
  });

  return {
    async getConfig(_req, res) {
      try {
        return res.json(await aiSettingsReadService.getConfig());
      } catch (error) {
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
        return res.json(await aiSettingsActionService.testConnection({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ success: false, error: error.message });
        }
        return res.json({ success: false, error: error.message });
      }
    },

    async getModels(req, res) {
      try {
        return res.json(await aiSettingsActionService.getModels({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }));
      } catch (error) {
        if (error.httpStatus) {
          return res.status(error.httpStatus).json({ success: false, error: error.message, models: [] });
        }
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
        return res.json(await aiSettingsActionService.resetUsage());
      } catch (error) {
        return res.status(500).json({ error: error.message });
      }
    },
  };
}

