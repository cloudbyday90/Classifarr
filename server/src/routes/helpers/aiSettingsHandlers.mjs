/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as encryptionModule from '../../utils/encryption.mjs';
import { validateAiSettingsPayloadKeys } from './aiSettingsHelpers.mjs';
import {
  buildAiModelsErrorResponse,
  buildAiModelsSuccessResponse,
  buildAiTestConnectionErrorResponse,
  buildAiTestConnectionSuccessResponse,
} from './aiSettingsActionResponseSupport.mjs';
import {
  buildAiStatusErrorResponse,
  buildAiStatusSuccessResponse,
  buildAiUsageErrorResponse,
  buildAiUsageSuccessResponse,
} from './aiSettingsReadResponseSupport.mjs';
import { persistAiSettingsConfig } from './aiSettingsPersistence.mjs';
import { finalizeAiSettingsResponseConfig } from './aiSettingsResponseSupport.mjs';
import { buildSettingsErrorResponse } from './settingsErrorSupport.mjs';
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
  });

  return {
    async getConfig(_req, res) {
      try {
        return res.json(await aiSettingsReadService.getConfig());
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
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
        const response = buildSettingsErrorResponse(error, {
          extras: error?.currentSum === undefined ? {} : { currentSum: error.currentSum },
        });
        return res.status(response.status).json(response.body);
      }
    },

    async testConnection(req, res) {
      try {
        const response = buildAiTestConnectionSuccessResponse(await aiSettingsActionService.testConnection({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }));

        return res.status(response.status).json(response.body);
      } catch (error) {
        const response = buildAiTestConnectionErrorResponse(error);

        return res.status(response.status).json(response.body);
      }
    },

    async getModels(req, res) {
      try {
        const response = buildAiModelsSuccessResponse(await aiSettingsActionService.getModels({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }));

        return res.status(response.status).json(response.body);
      } catch (error) {
        const response = buildAiModelsErrorResponse(error);

        return res.status(response.status).json(response.body);
      }
    },

    async getUsage(_req, res) {
      try {
        const response = buildAiUsageSuccessResponse(await aiSettingsReadService.getUsageSummary());

        return res.status(response.status).json(response.body);
      } catch (error) {
        const response = buildAiUsageErrorResponse(error, aiSettingsReadService.getUsageFallback());

        return res.status(response.status).json(response.body);
      }
    },

    async getStatus(_req, res) {
      try {
        const response = buildAiStatusSuccessResponse(await aiSettingsReadService.getStatus());

        return res.status(response.status).json(response.body);
      } catch (error) {
        const response = buildAiStatusErrorResponse(error);

        return res.status(response.status).json(response.body);
      }
    },

    async resetUsage(_req, res) {
      try {
        return res.json(await aiSettingsActionService.resetUsage());
      } catch (error) {
        const response = buildSettingsErrorResponse(error);
        return res.status(response.status).json(response.body);
      }
    },
  };
}

