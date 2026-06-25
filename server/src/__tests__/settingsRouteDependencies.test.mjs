/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const rateLimit = jest.fn(() => 'ssl-limiter');
const createLogger = jest.fn(() => logger);
const resolveRequestApiKey = jest.fn();
const sslTestLimiterConfig = { windowMs: 60_000, max: 5 };

const arrDependencies = {
  database: { kind: 'arr-db' },
  radarrService: { kind: 'radarr-service' },
  sonarrService: { kind: 'sonarr-service' },
};
const aiDependencies = {
  database: { kind: 'ai-db' },
  logger,
  cloudLLMService: { kind: 'cloud-llm-service' },
  aiRouterService: { kind: 'ai-router-service' },
  ollamaService: { kind: 'ollama-service' },
  embeddingProvider: { kind: 'embedding-provider' },
  embeddingRouter: { kind: 'embedding-router' },
  backfillOrchestratorService: { kind: 'backfill-orchestrator' },
  getRagLoopDefaultConfig: { kind: 'rag-loop-default-config' },
  validateAndNormalizeRagLoopConfig: { kind: 'validate-rag-loop' },
  validateRagLoopConfigPayloadKeys: { kind: 'validate-rag-payload-keys' },
  tmdbService: { kind: 'tmdb-service' },
  tavilyService: { kind: 'tavily-service' },
  omdbService: { kind: 'omdb-service' },
  schedulerService: { kind: 'scheduler-service' },
  autoLearningService: { kind: 'auto-learning-service' },
  encryptValue: { kind: 'encrypt-value' },
  formatEncryptedValue: { kind: 'format-encrypted-value' },
  parseEncryptedValue: { kind: 'parse-encrypted-value' },
  decryptValue: { kind: 'decrypt-value' },
  webSearchProviderStorage: { kind: 'web-search-provider-storage' },
  webSearchProviderRegistry: { kind: 'web-search-provider-registry' },
  webSearchProviderRouter: { kind: 'web-search-provider-router' },
  webSearchProviderRouteHistory: { kind: 'web-search-provider-route-history' },
};
const operationalDependencies = {
  database: { kind: 'operational-db' },
  logger,
  discordBotService: { kind: 'discord-bot-service' },
  httpClient: { kind: 'http-client' },
  pathTestService: { kind: 'path-test-service' },
  providerLock: { kind: 'provider-lock' },
  runtimeSettings: { kind: 'runtime-settings' },
  startupService: { kind: 'startup-service' },
  webhookService: { kind: 'webhook-service' },
};

const createArrSettingsDependencies = jest.fn(() => arrDependencies);
const createAiSettingsDependencies = jest.fn(() => aiDependencies);
const createOperationalSettingsDependencies = jest.fn(() => operationalDependencies);

const createArrSettingsRouteHandlers = jest.fn(() => ({
  arrConfigStatusHandler: 'arr-status-handler',
  radarrHandlers: 'radarr-handlers',
  sonarrHandlers: 'sonarr-handlers',
}));
const createAiSettingsHandlers = jest.fn(() => 'ai-handlers');
const createConfidenceSettingsHandlers = jest.fn(() => 'confidence-handlers');
const createMetadataProviderSettingsHandlers = jest.fn(() => 'metadata-handlers');
const createOllamaSettingsHandlers = jest.fn(() => 'ollama-handlers');
const createWebSearchProviderSettingsHandlers = jest.fn(() => 'web-search-provider-handlers');
const createDiscordSettingsHandlers = jest.fn(() => 'discord-handlers');
const createGeneralSettingsHandlers = jest.fn(() => 'general-handlers');
const createPathTestingHandlers = jest.fn(() => 'path-testing-handlers');
const createProviderLockHandlers = jest.fn(() => 'provider-lock-handlers');
const createSetupHandlers = jest.fn(() => 'setup-handlers');
const createSslSettingsHandlers = jest.fn(() => 'ssl-handlers');
const createWebhookSettingsHandlers = jest.fn(() => 'webhook-handlers');

jest.unstable_mockModule('express-rate-limit', () => ({
  default: rateLimit,
}));

jest.unstable_mockModule('../config/rateLimits.mjs', () => ({
  sslTestLimiterConfig,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger,
}));

jest.unstable_mockModule('../routes/helpers/settingsRouteDependencyBuilders.mjs', () => ({
  createArrSettingsDependencies,
  createAiSettingsDependencies,
  createOperationalSettingsDependencies,
}));

jest.unstable_mockModule('../routes/helpers/arrSettingsRouteHandlers.mjs', () => ({
  createArrSettingsRouteHandlers,
}));

jest.unstable_mockModule('../routes/helpers/aiSettingsHandlers.mjs', () => ({
  createAiSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/confidenceSettingsHandlers.mjs', () => ({
  createConfidenceSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/metadataProviderSettingsHandlers.mjs', () => ({
  createMetadataProviderSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/ollamaSettingsHandlers.mjs', () => ({
  createOllamaSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/webSearchProviderSettingsHandlers.mjs', () => ({
  createWebSearchProviderSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/discordSettingsHandlers.mjs', () => ({
  createDiscordSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/generalSettingsHandlers.mjs', () => ({
  createGeneralSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/pathTestingHandlers.mjs', () => ({
  createPathTestingHandlers,
}));

jest.unstable_mockModule('../routes/helpers/providerLockHandlers.mjs', () => ({
  createProviderLockHandlers,
}));

jest.unstable_mockModule('../routes/helpers/providerConfigHelpers.mjs', () => ({
  resolveRequestApiKey,
}));

jest.unstable_mockModule('../routes/helpers/setupHandlers.mjs', () => ({
  createSetupHandlers,
}));

jest.unstable_mockModule('../routes/helpers/sslSettingsHandlers.mjs', () => ({
  createSslSettingsHandlers,
}));

jest.unstable_mockModule('../routes/helpers/webhookSettingsHandlers.mjs', () => ({
  createWebhookSettingsHandlers,
}));

const {
  createSettingsRouteDependencies,
} = await import('../routes/settingsRouteDependencies.mjs');
const {
  createAiHandlerDescriptors,
  createOperationalHandlerDescriptors,
} = await import('../routes/helpers/settingsRouteHandlerDescriptors.mjs');

describe('settingsRouteDependencies', () => {
  beforeEach(() => {
    logger.info.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
    logger.debug.mockReset();
    rateLimit.mockReset();
    createLogger.mockReset();
    resolveRequestApiKey.mockReset();
    createArrSettingsDependencies.mockReset();
    createAiSettingsDependencies.mockReset();
    createOperationalSettingsDependencies.mockReset();
    createArrSettingsRouteHandlers.mockReset();
    createAiSettingsHandlers.mockReset();
    createConfidenceSettingsHandlers.mockReset();
    createMetadataProviderSettingsHandlers.mockReset();
    createOllamaSettingsHandlers.mockReset();
    createWebSearchProviderSettingsHandlers.mockReset();
    createDiscordSettingsHandlers.mockReset();
    createGeneralSettingsHandlers.mockReset();
    createPathTestingHandlers.mockReset();
    createProviderLockHandlers.mockReset();
    createSetupHandlers.mockReset();
    createSslSettingsHandlers.mockReset();
    createWebhookSettingsHandlers.mockReset();

    createArrSettingsDependencies.mockReturnValue(arrDependencies);
    createAiSettingsDependencies.mockReturnValue(aiDependencies);
    createOperationalSettingsDependencies.mockReturnValue(operationalDependencies);
    createArrSettingsRouteHandlers.mockReturnValue({
      arrConfigStatusHandler: 'arr-status-handler',
      radarrHandlers: 'radarr-handlers',
      sonarrHandlers: 'sonarr-handlers',
    });
    createAiSettingsHandlers.mockReturnValue('ai-handlers');
    createConfidenceSettingsHandlers.mockReturnValue('confidence-handlers');
    createMetadataProviderSettingsHandlers.mockReturnValue('metadata-handlers');
    createOllamaSettingsHandlers.mockReturnValue('ollama-handlers');
    createWebSearchProviderSettingsHandlers.mockReturnValue('web-search-provider-handlers');
    createDiscordSettingsHandlers.mockReturnValue('discord-handlers');
    createGeneralSettingsHandlers.mockReturnValue('general-handlers');
    createPathTestingHandlers.mockReturnValue('path-testing-handlers');
    createProviderLockHandlers.mockReturnValue('provider-lock-handlers');
    createSetupHandlers.mockReturnValue('setup-handlers');
    createSslSettingsHandlers.mockReturnValue('ssl-handlers');
    createWebhookSettingsHandlers.mockReturnValue('webhook-handlers');
    createLogger.mockReturnValue(logger);
    rateLimit.mockReturnValue('ssl-limiter');
  });

  it('exposes AI handler descriptors with stable handler keys and dependency wiring', () => {
    const descriptors = createAiHandlerDescriptors(aiDependencies, logger);

    expect(descriptors.map(({ key }) => key)).toEqual([
      'aiHandlers',
      'confidenceSettingsHandlers',
      'metadataProviderHandlers',
      'webSearchProviderHandlers',
      'ollamaHandlers',
    ]);

    const result = Object.fromEntries(descriptors.map(({ key, create }) => [key, create()]));

    expect(createAiSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      cloudLLMService: aiDependencies.cloudLLMService,
      aiRouterService: aiDependencies.aiRouterService,
      ollamaService: aiDependencies.ollamaService,
      embeddingProvider: aiDependencies.embeddingProvider,
      embeddingRouter: aiDependencies.embeddingRouter,
      backfillOrchestratorService: aiDependencies.backfillOrchestratorService,
      getRagLoopDefaultConfig: aiDependencies.getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig: aiDependencies.validateAndNormalizeRagLoopConfig,
      validateRagLoopConfigPayloadKeys: aiDependencies.validateRagLoopConfigPayloadKeys,
      resolveRequestApiKey,
      encryptValue: aiDependencies.encryptValue,
      formatEncryptedValue: aiDependencies.formatEncryptedValue,
      parseEncryptedValue: aiDependencies.parseEncryptedValue,
      decryptValue: aiDependencies.decryptValue,
    });
    expect(createConfidenceSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      autoLearningService: aiDependencies.autoLearningService,
    });
    expect(createMetadataProviderSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      tmdbService: aiDependencies.tmdbService,
      tavilyService: aiDependencies.tavilyService,
      omdbService: aiDependencies.omdbService,
      schedulerService: aiDependencies.schedulerService,
    });
    expect(createWebSearchProviderSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      webSearchProviderStorage: aiDependencies.webSearchProviderStorage,
      webSearchProviderRegistry: aiDependencies.webSearchProviderRegistry,
      webSearchProviderRouter: aiDependencies.webSearchProviderRouter,
      webSearchProviderRouteHistory: aiDependencies.webSearchProviderRouteHistory,
    });
    expect(createOllamaSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      ollamaService: aiDependencies.ollamaService,
    });

    expect(result).toEqual({
      aiHandlers: 'ai-handlers',
      confidenceSettingsHandlers: 'confidence-handlers',
      metadataProviderHandlers: 'metadata-handlers',
      webSearchProviderHandlers: 'web-search-provider-handlers',
      ollamaHandlers: 'ollama-handlers',
    });
  });

  it('exposes operational descriptors with stable handler keys and dependency wiring', () => {
    const descriptors = createOperationalHandlerDescriptors(operationalDependencies);

    expect(descriptors.map(({ key }) => key)).toEqual([
      'discordHandlers',
      'generalSettingsHandlers',
      'pathTestingHandlers',
      'providerLockHandlers',
      'setupHandlers',
      'sslHandlers',
      'sslTestLimiter',
      'webhookHandlers',
    ]);

    const result = Object.fromEntries(descriptors.map(({ key, create }) => [key, create()]));

    expect(createDiscordSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
      discordBotService: operationalDependencies.discordBotService,
      logger,
    });
    expect(createGeneralSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
      runtimeSettings: operationalDependencies.runtimeSettings,
    });
    expect(createPathTestingHandlers).toHaveBeenCalledWith({
      pathTestService: operationalDependencies.pathTestService,
    });
    expect(createProviderLockHandlers).toHaveBeenCalledWith({
      providerLock: operationalDependencies.providerLock,
    });
    expect(createSetupHandlers).toHaveBeenCalledWith({
      startupService: operationalDependencies.startupService,
    });
    expect(createSslSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
    });
    expect(rateLimit).toHaveBeenCalledWith(sslTestLimiterConfig);
    expect(createWebhookSettingsHandlers).toHaveBeenCalledWith({
      webhookService: operationalDependencies.webhookService,
      httpClient: operationalDependencies.httpClient,
    });

    expect(result).toEqual({
      discordHandlers: 'discord-handlers',
      generalSettingsHandlers: 'general-handlers',
      pathTestingHandlers: 'path-testing-handlers',
      providerLockHandlers: 'provider-lock-handlers',
      setupHandlers: 'setup-handlers',
      sslHandlers: 'ssl-handlers',
      sslTestLimiter: 'ssl-limiter',
      webhookHandlers: 'webhook-handlers',
    });
  });

  it('assembles grouped settings handlers through the dependency builders and local descriptor map', () => {
    const dependencyOverrides = { customDependency: 'custom-value' };

    const result = createSettingsRouteDependencies(dependencyOverrides);

    expect(createLogger).toHaveBeenCalledWith('SettingsRoutes');
    expect(createArrSettingsDependencies).toHaveBeenCalledWith(dependencyOverrides);
    expect(createAiSettingsDependencies).toHaveBeenCalledWith({
      ...dependencyOverrides,
      logger,
    });
    expect(createOperationalSettingsDependencies).toHaveBeenCalledWith({
      ...dependencyOverrides,
      logger,
    });

    expect(createArrSettingsRouteHandlers).toHaveBeenCalledWith(arrDependencies);
    expect(createAiSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      cloudLLMService: aiDependencies.cloudLLMService,
      aiRouterService: aiDependencies.aiRouterService,
      ollamaService: aiDependencies.ollamaService,
      embeddingProvider: aiDependencies.embeddingProvider,
      embeddingRouter: aiDependencies.embeddingRouter,
      backfillOrchestratorService: aiDependencies.backfillOrchestratorService,
      getRagLoopDefaultConfig: aiDependencies.getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig: aiDependencies.validateAndNormalizeRagLoopConfig,
      validateRagLoopConfigPayloadKeys: aiDependencies.validateRagLoopConfigPayloadKeys,
      resolveRequestApiKey,
      encryptValue: aiDependencies.encryptValue,
      formatEncryptedValue: aiDependencies.formatEncryptedValue,
      parseEncryptedValue: aiDependencies.parseEncryptedValue,
      decryptValue: aiDependencies.decryptValue,
    });
    expect(createConfidenceSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      autoLearningService: aiDependencies.autoLearningService,
    });
    expect(createMetadataProviderSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      tmdbService: aiDependencies.tmdbService,
      tavilyService: aiDependencies.tavilyService,
      omdbService: aiDependencies.omdbService,
      schedulerService: aiDependencies.schedulerService,
    });
    expect(createWebSearchProviderSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      webSearchProviderStorage: aiDependencies.webSearchProviderStorage,
      webSearchProviderRegistry: aiDependencies.webSearchProviderRegistry,
      webSearchProviderRouter: aiDependencies.webSearchProviderRouter,
      webSearchProviderRouteHistory: aiDependencies.webSearchProviderRouteHistory,
    });
    expect(createOllamaSettingsHandlers).toHaveBeenCalledWith({
      db: aiDependencies.database,
      logger,
      ollamaService: aiDependencies.ollamaService,
    });

    expect(createDiscordSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
      discordBotService: operationalDependencies.discordBotService,
      logger,
    });
    expect(createGeneralSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
      runtimeSettings: operationalDependencies.runtimeSettings,
    });
    expect(createPathTestingHandlers).toHaveBeenCalledWith({
      pathTestService: operationalDependencies.pathTestService,
    });
    expect(createProviderLockHandlers).toHaveBeenCalledWith({
      providerLock: operationalDependencies.providerLock,
    });
    expect(createSetupHandlers).toHaveBeenCalledWith({
      startupService: operationalDependencies.startupService,
    });
    expect(createSslSettingsHandlers).toHaveBeenCalledWith({
      db: operationalDependencies.database,
    });
    expect(rateLimit).toHaveBeenCalledWith(sslTestLimiterConfig);
    expect(createWebhookSettingsHandlers).toHaveBeenCalledWith({
      webhookService: operationalDependencies.webhookService,
      httpClient: operationalDependencies.httpClient,
    });

    expect(result).toEqual({
      arrConfigStatusHandler: 'arr-status-handler',
      radarrHandlers: 'radarr-handlers',
      sonarrHandlers: 'sonarr-handlers',
      aiHandlers: 'ai-handlers',
      confidenceSettingsHandlers: 'confidence-handlers',
      metadataProviderHandlers: 'metadata-handlers',
      webSearchProviderHandlers: 'web-search-provider-handlers',
      ollamaHandlers: 'ollama-handlers',
      discordHandlers: 'discord-handlers',
      generalSettingsHandlers: 'general-handlers',
      pathTestingHandlers: 'path-testing-handlers',
      providerLockHandlers: 'provider-lock-handlers',
      setupHandlers: 'setup-handlers',
      sslHandlers: 'ssl-handlers',
      sslTestLimiter: 'ssl-limiter',
      webhookHandlers: 'webhook-handlers',
    });
  });

  it('honors an injected logger instead of creating a new one', () => {
    const injectedLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    createSettingsRouteDependencies({
      customDependency: 'custom-value',
      logger: injectedLogger,
    });

    expect(createLogger).not.toHaveBeenCalled();
    expect(createAiSettingsDependencies).toHaveBeenCalledWith({
      customDependency: 'custom-value',
      logger: injectedLogger,
    });
    expect(createOperationalSettingsDependencies).toHaveBeenCalledWith({
      customDependency: 'custom-value',
      logger: injectedLogger,
    });
  });
});
