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
import {
  finalizeAiSettingsResponseConfig,
} from './aiSettingsResponseSupport.mjs';
import { buildSettingsErrorResponse, trySettingsAction } from './settingsErrorSupport.mjs';
import { runSettingsRuntimeRefresh } from './settingsRuntimeRefreshSupport.mjs';
import { createAiSettingsActionService } from '../../services/aiSettingsActionService.mjs';
import { createAiSettingsReadService } from '../../services/aiSettingsReadService.mjs';
import { ValidationError } from '../../utils/appError.mjs';

/** @typedef {Record<string, unknown>} AiSettingsRequestBody */
/** @typedef {import('./settingsRouteContracts.mjs').SettingsBodyRequest<AiSettingsRequestBody>} SettingsRequest */
/** @typedef {import('./settingsRouteContracts.mjs').SettingsResponse} SettingsResponse */

/**
 * @typedef {{
 *   query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>,
 * }} SettingsDbClient
 */

/**
 * @typedef {{
 *   withTransaction: (callback: (client: SettingsDbClient) => Promise<any>) => Promise<any>,
 * }} SettingsDb
 */

/**
 * @typedef {{
 *   warn: (message: string, payload?: Record<string, unknown>) => void,
 *   error: (message: string, payload?: Record<string, unknown>) => void,
 *   info: (message: string, payload?: Record<string, unknown>) => void,
 * }} SettingsLogger
 */

/**
 * @typedef {{
 *   clearCache: () => void,
 * }} AiRouterService
 */

/**
 * @typedef {{
 *   resetConfig: () => void,
 * }} ResettableConfigService
 */

/**
 * @typedef {Error & {
 *   currentSum?: number,
 * }} AiSettingsHandlerError
 */

/**
 * @param {AiSettingsHandlerError} error
 * @returns {Record<string, number>}
 */
function getCurrentSumExtras(error) {
  return error?.currentSum === undefined ? {} : { currentSum: error.currentSum };
}

/**
 * @param {{
 *   logger: SettingsLogger,
 *   aiRouterService: AiRouterService,
 *   ollamaService: ResettableConfigService,
 *   embeddingProvider: ResettableConfigService,
 *   embeddingRouter: ResettableConfigService,
 * }} options
 */
function refreshAiSettingsRuntimeState({
  logger,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
}) {
  runSettingsRuntimeRefresh({
    context: 'ai-settings',
    logger,
    actions: [
      { label: 'ai-router-cache', run: () => aiRouterService.clearCache() },
      { label: 'ollama-config', run: () => ollamaService.resetConfig() },
      { label: 'embedding-provider-config', run: () => embeddingProvider.resetConfig() },
      { label: 'embedding-router-config', run: () => embeddingRouter.resetConfig() },
    ],
  });
}

/**
 * @param {{
 *   db: SettingsDb,
 *   logger: SettingsLogger,
 *   cloudLLMService: unknown,
 *   aiRouterService: AiRouterService,
 *   ollamaService: ResettableConfigService,
 *   embeddingProvider: ResettableConfigService,
 *   embeddingRouter: ResettableConfigService,
 *   backfillOrchestratorService?: {
 *     maybeStartIdleBackfill?: (reason?: string) => Promise<boolean> | boolean,
 *   },
 *   getRagLoopDefaultConfig: () => Record<string, unknown>,
 *   validateAndNormalizeRagLoopConfig: (body: AiSettingsRequestBody, existing: Record<string, unknown>) => {
 *     normalizedConfig: Record<string, unknown>,
 *     warnings: string[],
 *   },
 *   validateRagLoopConfigPayloadKeys: (payload: AiSettingsRequestBody) => {
 *     valid: boolean,
 *     unknownKeys: string[],
 *     disallowedKeys: string[],
 *   },
 *   resolveRequestApiKey: (...args: any[]) => Promise<string>,
 *   encryptValue?: (value: string) => { encrypted: string, iv: string, authTag: string },
 *   formatEncryptedValue?: (encrypted: string, iv: string, authTag: string) => string,
 *   parseEncryptedValue?: (formatted: string) => { encrypted: string, iv: string, authTag: string },
 *   decryptValue?: (encrypted: string, iv: string, authTag: string) => string,
 * }} options
 */
export function createAiSettingsHandlers({
  db,
  logger,
  cloudLLMService,
  aiRouterService,
  ollamaService,
  embeddingProvider,
  embeddingRouter,
  backfillOrchestratorService = null,
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
    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getConfig(_req, res) {
      return res.json(await aiSettingsReadService.getConfig());
    },

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async updateConfig(req, res) {
      const ragLoopConfigKeyValidation = validateRagLoopConfigPayloadKeys(req.body || {});
      if (!ragLoopConfigKeyValidation.valid) {
        throw new ValidationError(
          'Unsupported RAG loop configuration keys in payload. Please reload the page and try again.',
          {
            unknown_rag_loop_config_keys: ragLoopConfigKeyValidation.unknownKeys,
            disallowed_rag_loop_override_keys: ragLoopConfigKeyValidation.disallowedKeys,
          },
        );
      }

      const aiSettingsKeyValidation = validateAiSettingsPayloadKeys(req.body || {}, getRagLoopDefaultConfig());
      if (!aiSettingsKeyValidation.valid) {
        throw new ValidationError(
          'Unsupported AI settings keys in payload. Please reload the page and try again.',
          {
            unknown_ai_settings_keys: aiSettingsKeyValidation.unknownKeys,
          },
        );
      }

      try {
        const { config, effects } = await db.withTransaction(async (client) => {
          return persistAiSettingsConfig({
            client,
            body: req.body,
            logger,
            validateAndNormalizeRagLoopConfig,
            encryptValue,
            formatEncryptedValue,
          });
        }); // end withTransaction

        refreshAiSettingsRuntimeState({
          logger,
          aiRouterService,
          ollamaService,
          embeddingProvider,
          embeddingRouter,
        });

        if (effects?.textEmbeddingsCleared && typeof backfillOrchestratorService?.maybeStartIdleBackfill === 'function') {
          try {
            await backfillOrchestratorService.maybeStartIdleBackfill('ai_settings_embedding_identity_change');
          } catch (reconcileError) {
            logger.warn('RAG backfill reconcile failed after AI settings update', {
              error: reconcileError.message,
            });
          }
        }

        finalizeAiSettingsResponseConfig({
          config,
          parseEncryptedValue,
          decryptValue,
        });

        return res.json(config);
      } catch (error) {
        const response = buildSettingsErrorResponse(error, {
          extras: getCurrentSumExtras(/** @type {AiSettingsHandlerError} */ (error)),
        });
        return res.status(response.status).json(response.body);
      }
    },

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async testConnection(req, res) {
      return trySettingsAction({
        action: () => aiSettingsActionService.testConnection({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }),
        buildSuccess: buildAiTestConnectionSuccessResponse,
        buildError: buildAiTestConnectionErrorResponse,
      }, res);
    },

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async getModels(req, res) {
      return trySettingsAction({
        action: () => aiSettingsActionService.getModels({
          body: req.body,
          dbOrClient: db,
          resolveRequestApiKey,
        }),
        buildSuccess: buildAiModelsSuccessResponse,
        buildError: buildAiModelsErrorResponse,
      }, res);
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getUsage(_req, res) {
      return trySettingsAction({
        action: () => aiSettingsReadService.getUsageSummary(),
        buildSuccess: buildAiUsageSuccessResponse,
        buildError: (error) => buildAiUsageErrorResponse(error, aiSettingsReadService.getUsageFallback()),
      }, res);
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getStatus(_req, res) {
      return trySettingsAction({
        action: () => aiSettingsReadService.getStatus(),
        buildSuccess: buildAiStatusSuccessResponse,
        buildError: buildAiStatusErrorResponse,
      }, res);
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async resetUsage(_req, res) {
      return res.json(await aiSettingsActionService.resetUsage());
    },
  };
}
