import { settingsTestRouterDependencies } from './settingsTestDependencies.mjs';

async function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const {
    authenticateToken,
    requireAdmin,
    createSettingsRouteDependencies,
    createSettingsRouter,
    database,
    radarrService,
    sonarrService,
    discordBotService,
    defaultHttpClient,
    embeddingProvider,
    embeddingRouter,
    ollamaService,
    tmdbService,
    tavilyService,
    omdbService,
    pathTestService,
    cloudLLMService,
    aiRouterService,
    autoLearningService,
    schedulerService,
    startupService,
    runtimeSettings,
    providerLock,
    webhookService,
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
    encryptValue,
    formatEncryptedValue,
    parseEncryptedValue,
    decryptValue,
  } = settingsTestRouterDependencies;

  const { httpClient: overriddenHttpClient, ...routeDependencyOverrides } = dependencyOverrides;

  const routeDependencies = {
    ...createSettingsRouteDependencies({
      database,
      radarrService,
      sonarrService,
      discordBotService,
      httpClient: overriddenHttpClient || defaultHttpClient,
      embeddingProvider,
      embeddingRouter,
      ollamaService,
      tmdbService,
      tavilyService,
      omdbService,
      pathTestService,
      cloudLLMService,
      aiRouterService,
      autoLearningService,
      schedulerService,
      startupService,
      runtimeSettings,
      providerLock,
      webhookService,
      getRagLoopDefaultConfig,
      validateAndNormalizeRagLoopConfig,
      encryptValue,
      formatEncryptedValue,
      parseEncryptedValue,
      decryptValue,
    }),
    ...routeDependencyOverrides,
  };

  return createSettingsRouter({
    express,
    authenticateToken,
    requireAdmin,
    ...routeDependencies,
  });
}

export {
  createSettingsTestRouter,
};
