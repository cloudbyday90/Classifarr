async function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const { default: database } = await import('../../config/database.mjs');
  const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
  const { radarrService } = await import('../../services/radarr.mjs');
  const { sonarrService } = await import('../../services/sonarr.mjs');
  const { discordBotService } = await import('../../services/discordBot.mjs');
  const { embeddingProvider } = await import('../../services/embeddingProvider.mjs');
  const { embeddingRouter } = await import('../../services/embeddingRouter.mjs');
  const { ollamaService } = await import('../../services/ollama.mjs');
  const { tmdbService } = await import('../../services/tmdb.mjs');
  const { tavilyService } = await import('../../services/tavily.mjs');
  const { omdbService } = await import('../../services/omdb.mjs');
  const { pathTestService } = await import('../../services/pathTestService.mjs');
  const { cloudLLMService } = await import('../../services/cloudLLM.mjs');
  const { aiRouterService } = await import('../../services/aiRouter.mjs');
  const { autoLearningService } = await import('../../services/autoLearningService.mjs');
  const { schedulerService } = await import('../../services/scheduler.mjs');
  const { startupService } = await import('../../services/startupService.mjs');
  const { default: runtimeSettings } = await import('../../config/runtimeSettings.mjs');
  const { providerLock } = await import('../../services/providerLock.mjs');
  const { webhookService } = await import('../../services/webhook.mjs');
  const { defaultHttpClient } = await import('../../utils/httpClient.mjs');
  const {
    getRagLoopDefaultConfig,
    validateAndNormalizeRagLoopConfig,
  } = await import('../../utils/ragLoopConfig.mjs');
  const {
    encryptValue,
    formatEncryptedValue,
    parseEncryptedValue,
    decryptValue,
  } = await import('../../utils/encryption.mjs');
  const [{ createSettingsRouteDependencies }, { createSettingsRouter }] = await Promise.all([
    import('../../routes/settingsRouteDependencies.mjs'),
    import('../../routes/settingsRouteShared.mjs'),
  ]);

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
