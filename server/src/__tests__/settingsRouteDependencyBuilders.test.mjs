/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { createNamedMockModule } from './helpers/mockFactory.mjs';

const defaultHttpClient = { kind: 'default-http-client' };
const httpGet = jest.fn();
const httpPost = jest.fn();
const httpPut = jest.fn();
const httpDelete = jest.fn();
const httpGetBinary = jest.fn();
const httpStream = jest.fn();
const query = jest.fn();
const withTransaction = jest.fn();
const radarrService = { kind: 'radarr-service' };
const sonarrService = { kind: 'sonarr-service' };
const ollamaService = { kind: 'ollama-service' };
const tmdbService = { kind: 'tmdb-service' };
const discordBotService = { kind: 'discord-bot-service' };
const tavilyService = { kind: 'tavily-service' };
const omdbService = { kind: 'omdb-service' };
const embeddingProvider = { kind: 'embedding-provider' };
const embeddingRouter = { kind: 'embedding-router' };
const startupService = { kind: 'startup-service' };
const pathTestService = { kind: 'path-test-service' };
const refreshFromDatabase = jest.fn();
const getRagLoopDefaultConfig = jest.fn(() => ({ kind: 'rag-defaults' }));
const validateAndNormalizeRagLoopConfig = jest.fn((config) => ({ normalizedConfig: config, warnings: [] }));
const decryptValue = jest.fn();
const encryptValue = jest.fn();
const formatEncryptedValue = jest.fn();
const parseEncryptedValue = jest.fn();
const validateRagLoopConfigPayloadKeys = jest.fn();
const webhookService = { kind: 'webhook-service' };
const cloudLLMService = { kind: 'cloud-llm-service' };
const aiRouterService = { kind: 'ai-router-service' };
const schedulerService = { kind: 'scheduler-service' };
const providerLock = { kind: 'provider-lock' };
const autoLearningService = { kind: 'auto-learning-service' };
const backfillOrchestrator = { kind: 'backfill-orchestrator-service' };
const webSearchProviderStorage = { kind: 'web-search-provider-storage' };
const webSearchProviderRegistry = { kind: 'web-search-provider-registry' };
const webSearchProviderRouteHistory = { kind: 'web-search-provider-route-history' };
const webSearchProviderQualityCalibrationService = { kind: 'web-search-provider-quality-calibration-service' };
const webSearchProviderHealthHistory = { kind: 'web-search-provider-health-history' };
const routedWebSearchProviderRouter = { kind: 'web-search-provider-router' };
const webSearchProviderRouter = {
  withDependencies: jest.fn(() => routedWebSearchProviderRouter),
};

jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  defaultHttpClient,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
  httpGetBinary,
  httpStream,
}));

jest.unstable_mockModule('../config/database.mjs', () => ({
  query,
  withTransaction,
}));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', radarrService));
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', sonarrService));
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', ollamaService));
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', tmdbService));
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', discordBotService));
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', tavilyService));
jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', omdbService));
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', embeddingProvider));
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', embeddingRouter));
jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', startupService));
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', pathTestService));

jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({
  refreshFromDatabase,
}));

jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({
  getRagLoopDefaultConfig,
  validateAndNormalizeRagLoopConfig,
}));

jest.unstable_mockModule('../utils/encryption.mjs', () => ({
  decryptValue,
  encryptValue,
  formatEncryptedValue,
  parseEncryptedValue,
}));

jest.unstable_mockModule('../utils/ragLoopPayloadValidation.mjs', () => ({
  validateRagLoopConfigPayloadKeys,
}));

jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', webhookService));
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', cloudLLMService));
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', aiRouterService));
jest.unstable_mockModule('../services/scheduler.mjs', () => createNamedMockModule('schedulerService', schedulerService));
jest.unstable_mockModule('../services/providerLock.mjs', () => createNamedMockModule('providerLock', providerLock));
jest.unstable_mockModule('../services/autoLearningService.mjs', () => createNamedMockModule('autoLearningService', autoLearningService));
jest.unstable_mockModule('../services/backfillOrchestrator.mjs', () => createNamedMockModule('backfillOrchestrator', backfillOrchestrator));
jest.unstable_mockModule('../services/webSearchProviderStorage.mjs', () => createNamedMockModule('webSearchProviderStorage', webSearchProviderStorage));
jest.unstable_mockModule('../services/webSearchProviderRegistry.mjs', () => createNamedMockModule('webSearchProviderRegistry', webSearchProviderRegistry));
jest.unstable_mockModule('../services/webSearchProviderRouter.mjs', () => createNamedMockModule('webSearchProviderRouter', webSearchProviderRouter));
jest.unstable_mockModule('../services/webSearchProviderRouteHistory.mjs', () => createNamedMockModule('webSearchProviderRouteHistory', webSearchProviderRouteHistory));
jest.unstable_mockModule('../services/webSearchProviderQualityCalibration.mjs', () => createNamedMockModule('webSearchProviderQualityCalibrationService', webSearchProviderQualityCalibrationService));
jest.unstable_mockModule('../services/webSearchProviderHealthHistory.mjs', () => createNamedMockModule('webSearchProviderHealthHistory', webSearchProviderHealthHistory));

const {
  defaultDatabase,
  defaultRuntimeSettings,
  createArrSettingsDependencies,
  createAiSettingsDependencies,
  createOperationalSettingsDependencies,
} = await import('../routes/helpers/settingsRouteDependencyBuilders.mjs');

describe('settingsRouteDependencyBuilders', () => {
  beforeEach(() => {
    webSearchProviderRouter.withDependencies.mockClear();
  });

  it('exports the native default database and runtime settings bags', () => {
    expect(defaultDatabase).toEqual({
      query,
      withTransaction,
    });
    expect(defaultRuntimeSettings).toEqual({
      refreshFromDatabase,
    });
  });

  it('creates ARR settings dependencies from defaults and allows local overrides', () => {
    expect(createArrSettingsDependencies()).toEqual({
      database: defaultDatabase,
      radarrService,
      sonarrService,
    });

    const database = { kind: 'custom-arr-db' };
    const customRadarrService = { kind: 'custom-radarr-service' };

    expect(
      createArrSettingsDependencies({
        database,
        radarrService: customRadarrService,
      }),
    ).toEqual({
      database,
      radarrService: customRadarrService,
      sonarrService,
    });
  });

  it('creates AI settings dependencies with native defaults and targeted overrides', () => {
    const logger = { kind: 'logger' };

    expect(createAiSettingsDependencies({ logger })).toEqual({
      database: defaultDatabase,
      logger,
      cloudLLMService,
      aiRouterService,
      ollamaService,
      embeddingProvider,
      embeddingRouter,
      getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig,
      validateRagLoopConfigPayloadKeys,
      tmdbService,
      tavilyService,
      omdbService,
      schedulerService,
      autoLearningService,
      backfillOrchestratorService: backfillOrchestrator,
      encryptValue,
      formatEncryptedValue,
      parseEncryptedValue,
      decryptValue,
      webSearchProviderStorage,
      webSearchProviderRegistry,
      webSearchProviderRouter: routedWebSearchProviderRouter,
      webSearchProviderRouteHistory,
      webSearchProviderQualityCalibrationService,
      webSearchProviderHealthHistory,
    });

    const database = { kind: 'custom-ai-db' };
    const customEmbeddingProvider = { kind: 'custom-embedding-provider' };
    const customCloudLLMService = { kind: 'custom-cloud-llm-service' };

    expect(
      createAiSettingsDependencies({
        database,
        logger,
        embeddingProvider: customEmbeddingProvider,
        cloudLLMService: customCloudLLMService,
      }),
    ).toEqual({
      database,
      logger,
      cloudLLMService: customCloudLLMService,
      aiRouterService,
      ollamaService,
      embeddingProvider: customEmbeddingProvider,
      embeddingRouter,
      getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig,
      validateRagLoopConfigPayloadKeys,
      tmdbService,
      tavilyService,
      omdbService,
      schedulerService,
      autoLearningService,
      backfillOrchestratorService: backfillOrchestrator,
      encryptValue,
      formatEncryptedValue,
      parseEncryptedValue,
      decryptValue,
      webSearchProviderStorage,
      webSearchProviderRegistry,
      webSearchProviderRouter: routedWebSearchProviderRouter,
      webSearchProviderRouteHistory,
      webSearchProviderQualityCalibrationService,
      webSearchProviderHealthHistory,
    });
    expect(webSearchProviderRouter.withDependencies).toHaveBeenCalledWith({
      storage: webSearchProviderStorage,
      registry: webSearchProviderRegistry,
      routeHistory: webSearchProviderRouteHistory,
      qualityCalibrationService: webSearchProviderQualityCalibrationService,
    });
  });

  it('creates operational settings dependencies with native defaults and targeted overrides', () => {
    const logger = { kind: 'logger' };

    expect(createOperationalSettingsDependencies({ logger })).toEqual({
      database: defaultDatabase,
      logger,
      discordBotService,
      webhookService,
      httpClient: defaultHttpClient,
      pathTestService,
      providerLock,
      startupService,
      runtimeSettings: defaultRuntimeSettings,
    });

    const database = { kind: 'custom-operational-db' };
    const customHttpClient = { kind: 'custom-http-client' };
    const customProviderLock = { kind: 'custom-provider-lock' };

    expect(
      createOperationalSettingsDependencies({
        database,
        logger,
        httpClient: customHttpClient,
        providerLock: customProviderLock,
      }),
    ).toEqual({
      database,
      logger,
      discordBotService,
      webhookService,
      httpClient: customHttpClient,
      pathTestService,
      providerLock: customProviderLock,
      startupService,
      runtimeSettings: defaultRuntimeSettings,
    });
  });
});
