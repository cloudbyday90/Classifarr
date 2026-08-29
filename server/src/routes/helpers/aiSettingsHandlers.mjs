/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import * as encryptionModule from '../../utils/encryption.mjs';
import {
  validateAiSettingsPayloadKeys,
  validateAiVerificationPreflightPayload,
} from './aiSettingsHelpers.mjs';
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
import {
  AI_SETTINGS_WRITE_PRECONDITION_HEADER,
  createAiSettingsWritePreconditionService,
  isAiSettingsWritePreconditionError,
} from '../../services/aiSettingsWritePrecondition.mjs';
import {
  createCandidateBoundVerificationProviderPreflightService,
} from '../../services/classificationCandidateBoundVerificationProviderPreflightService.mjs';
import {
  createOllamaVerificationCapabilityService,
} from '../../services/ollamaVerificationCapabilityService.mjs';
import {
  createOllamaVerificationCompatibilityMatrixService,
} from '../../services/ollamaVerificationCompatibilityMatrixService.mjs';
import {
  createOllamaVerificationCompatibilityMatrixHandler,
} from './ollamaVerificationCompatibilityMatrixHandler.mjs';
import {
  OllamaVerificationCapabilityConfigurationChangedError,
} from '../../services/ollamaVerificationCapabilityRepository.mjs';
import {
  CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS,
} from '../../services/classificationCandidateBoundVerificationProviderPreflight.mjs';
import {
  ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceiptRepository.mjs';
import {
  ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService,
} from '../../services/classificationCandidateBoundVerificationCapabilityChangeReceiptReadService.mjs';
import {
  getAiVerificationCapabilityChangeReceiptActorId,
} from '../../services/aiVerificationCapabilityChangeReceiptActorIdentity.mjs';
import { ForbiddenError, ValidationError } from '../../utils/appError.mjs';

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
 *   query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>,
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
 *   ollamaService: ResettableConfigService & import('../../services/ollamaVerificationCapabilityService.mjs').OllamaVerificationCapabilityClient,
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

function validateAiSettingsUpdatePayload({
  body,
  getRagLoopDefaultConfig,
  validateRagLoopConfigPayloadKeys,
}) {
  const ragLoopConfigKeyValidation = validateRagLoopConfigPayloadKeys(body || {});
  if (!ragLoopConfigKeyValidation.valid) {
    throw new ValidationError(
      'Unsupported RAG loop configuration keys in payload. Please reload the page and try again.',
      {
        unknown_rag_loop_config_keys: ragLoopConfigKeyValidation.unknownKeys,
        disallowed_rag_loop_override_keys: ragLoopConfigKeyValidation.disallowedKeys,
      },
    );
  }

  const aiSettingsKeyValidation = validateAiSettingsPayloadKeys(body || {}, getRagLoopDefaultConfig());
  if (!aiSettingsKeyValidation.valid) {
    throw new ValidationError(
      'Unsupported AI settings keys in payload. Please reload the page and try again.',
      {
        unknown_ai_settings_keys: aiSettingsKeyValidation.unknownKeys,
      },
    );
  }
}

function requireVerificationCapabilityChangeReceiptActorId(user) {
  const actorId = getAiVerificationCapabilityChangeReceiptActorId(user);
  if (!actorId) {
    throw new ForbiddenError('A stable authenticated administrator identity is required.', {
      code: 'verification_capability_receipt_actor_identity_required',
    });
  }
  return actorId;
}

/**
 * @param {{
 *   db: SettingsDb,
 *   logger: SettingsLogger,
 *   cloudLLMService: unknown,
 *   aiRouterService: AiRouterService,
 *   ollamaService: ResettableConfigService & import('../../services/ollamaVerificationCapabilityService.mjs').OllamaVerificationCapabilityClient,
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
 *   candidateBoundVerificationProviderPreflightService?: {
 *     getPreflight: (request?: { proposedConfiguration?: AiSettingsRequestBody, presentationContext?: string }) => Promise<Record<string, unknown>>,
 *   },
 *   ollamaVerificationCapabilityService?: {
 *     testSavedConfiguration: () => Promise<Record<string, unknown>>,
 *   },
 *   ollamaVerificationCompatibilityMatrixService?: {
 *     run: () => Promise<Record<string, unknown>>,
 *   },
 *   ollamaVerificationCompatibilityMatrixHandler?: {
 *     run: (req: SettingsRequest, res: SettingsResponse) => Promise<unknown>,
 *   },
 *   verificationCapabilityChangeReceiptRepository?: {
 *     record: (request: { client: SettingsDbClient, receipt: Record<string, unknown> }) => Promise<unknown>,
 *     listForActor: (request: Record<string, unknown>) => Promise<Record<string, unknown>[]>,
 *   },
 *   verificationCapabilityChangeReceiptReadService?: {
 *     list: (request: { actorId: string, query?: Record<string, unknown> }) => Promise<Record<string, unknown>>,
 *   },
 *   aiSettingsWritePreconditionService?: {
 *     issueForConfiguration: (configuration: Record<string, unknown> | null) => string,
 *     assertCurrent: (request: { providedPrecondition?: string, configuration: Record<string, unknown> | null }) => string,
 *   },
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
  candidateBoundVerificationProviderPreflightService = createCandidateBoundVerificationProviderPreflightService({
    database: db,
  }),
  ollamaVerificationCapabilityService = createOllamaVerificationCapabilityService({
    database: db,
    ollamaClient: ollamaService,
  }),
  ollamaVerificationCompatibilityMatrixService = createOllamaVerificationCompatibilityMatrixService({
    database: db,
  }),
  ollamaVerificationCompatibilityMatrixHandler = createOllamaVerificationCompatibilityMatrixHandler({
    matrixService: ollamaVerificationCompatibilityMatrixService,
  }),
  verificationCapabilityChangeReceiptRepository = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptRepository(),
  verificationCapabilityChangeReceiptReadService = null,
  aiSettingsWritePreconditionService = createAiSettingsWritePreconditionService(),
}) {
  let receiptReadService = verificationCapabilityChangeReceiptReadService;
  const getVerificationCapabilityChangeReceiptReadService = () => {
    if (!receiptReadService) {
      receiptReadService = new ClassificationCandidateBoundVerificationCapabilityChangeReceiptReadService({
        db,
        receiptRepository: verificationCapabilityChangeReceiptRepository,
      });
    }
    return receiptReadService;
  };
  const aiSettingsReadService = createAiSettingsReadService({
    db,
    aiRouterService,
    aiSettingsWritePreconditionService,
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
      const { config, writePrecondition } = await aiSettingsReadService.getConfigWithWritePrecondition();
      res.set('Cache-Control', 'no-store');
      if (writePrecondition) {
        res.set('ETag', writePrecondition);
      }
      return res.json(config);
    },

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async updateConfig(req, res) {
      validateAiSettingsUpdatePayload({
        body: req.body,
        getRagLoopDefaultConfig,
        validateRagLoopConfigPayloadKeys,
      });
      const verificationCapabilityChangeReceiptActorId = requireVerificationCapabilityChangeReceiptActorId(req.user);

      try {
        const { config, effects } = await db.withTransaction(async (client) => {
          return persistAiSettingsConfig({
            client,
            body: req.body,
            logger,
            validateAndNormalizeRagLoopConfig,
            encryptValue,
            formatEncryptedValue,
            aiSettingsWritePreconditionService,
            providedWritePrecondition: req.get?.(AI_SETTINGS_WRITE_PRECONDITION_HEADER),
            verificationCapabilityChangeReceiptRepository,
            verificationCapabilityChangeReceiptActorId,
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

        const writePrecondition = aiSettingsWritePreconditionService.issueForConfiguration(config);
        finalizeAiSettingsResponseConfig({
          config,
          parseEncryptedValue,
          decryptValue,
        });

        res.set('Cache-Control', 'no-store');
        res.set('ETag', writePrecondition);
        return res.json(config);
      } catch (error) {
        if (isAiSettingsWritePreconditionError(error)) {
          res.set('Cache-Control', 'no-store');
          return res.status(error.httpStatus).json({
            error: error.message,
            code: error.code,
            reload_required: true,
          });
        }
        const response = buildSettingsErrorResponse(error, {
          extras: getCurrentSumExtras(/** @type {AiSettingsHandlerError} */ (error)),
        });
        return res.status(response.status).json(response.body);
      }
    },

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async getVerificationPreflight(req, res) {
      const payloadValidation = validateAiVerificationPreflightPayload(req.body || {});
      if (payloadValidation.unknownKeys.length > 0) {
        throw new ValidationError(
          'Unsupported AI verification preflight keys in payload. Please reload the page and try again.',
          {
            unknown_ai_verification_preflight_keys: payloadValidation.unknownKeys,
          },
        );
      }
      if (payloadValidation.invalidKeys.length > 0) {
        throw new ValidationError(
          'Invalid AI verification preflight values in payload. Please reload the page and try again.',
          {
            invalid_ai_verification_preflight_keys: payloadValidation.invalidKeys,
          },
        );
      }

      const preflight = await candidateBoundVerificationProviderPreflightService.getPreflight({
        proposedConfiguration: req.body || {},
      });
      res.set('Cache-Control', 'no-store');
      return res.json(preflight);
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async getVerificationCapability(_req, res) {
      const capability = await candidateBoundVerificationProviderPreflightService.getPreflight({
        presentationContext:
          CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.SAVED_CONFIGURATION,
      });
      res.set('Cache-Control', 'no-store');
      return res.json(capability);
    },

    /** @param {SettingsRequest} _req @param {SettingsResponse} res */
    async testVerificationCapability(_req, res) {
      try {
        await ollamaVerificationCapabilityService.testSavedConfiguration();
        aiRouterService.clearCache();
        const capability = await candidateBoundVerificationProviderPreflightService.getPreflight({
          presentationContext:
            CANDIDATE_BOUND_VERIFICATION_PROVIDER_PREFLIGHT_PRESENTATION_CONTEXT_IDS.SAVED_CONFIGURATION,
        });
        res.set('Cache-Control', 'no-store');
        return res.json(capability);
      } catch (error) {
        if (error instanceof OllamaVerificationCapabilityConfigurationChangedError) {
          res.set('Cache-Control', 'no-store');
          return res.status(409).json({
            error: error.message,
            code: error.code,
            reload_required: true,
          });
        }
        throw error;
      }
    },

    runVerificationCompatibilityMatrix: ollamaVerificationCompatibilityMatrixHandler.run,

    /** @param {SettingsRequest} req @param {SettingsResponse} res */
    async getVerificationCapabilityChangeReceipts(req, res) {
      const receipts = await getVerificationCapabilityChangeReceiptReadService().list({
        actorId: requireVerificationCapabilityChangeReceiptActorId(req.user),
        query: req.query || {},
      });
      res.set('Cache-Control', 'no-store');
      return res.json(receipts);
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
