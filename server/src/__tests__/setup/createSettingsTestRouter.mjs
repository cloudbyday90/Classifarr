async function createSettingsTestRouter(express, dependencyOverrides = {}) {
  const { default: database } = await import('../../config/database.mjs');
  const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
  const { default: radarrService } = await import('../../services/radarr.mjs');
  const { default: sonarrService } = await import('../../services/sonarr.mjs');
  const { default: discordBotService } = await import('../../services/discordBot.mjs');
  const { default: embeddingProvider } = await import('../../services/embeddingProvider.mjs');
  const { default: embeddingRouter } = await import('../../services/embeddingRouter.mjs');
  const { default: ollamaService } = await import('../../services/ollama.mjs');
  const { default: tmdbService } = await import('../../services/tmdb.mjs');
  const { default: tavilyService } = await import('../../services/tavily.mjs');
  const { default: omdbService } = await import('../../services/omdb.mjs');
  const { default: pathTestService } = await import('../../services/pathTestService.mjs');
  const { default: cloudLLMService } = await import('../../services/cloudLLM.mjs');
  const { default: aiRouterService } = await import('../../services/aiRouter.mjs');
  const { default: autoLearningService } = await import('../../services/autoLearningService.mjs');
  const { default: schedulerService } = await import('../../services/scheduler.mjs');
  const { default: startupService } = await import('../../services/startupService.mjs');
  const { default: runtimeSettings } = await import('../../config/runtimeSettings.mjs');
  const { default: providerLock } = await import('../../services/providerLock.mjs');
  const { default: webhookService } = await import('../../services/webhook.mjs');
  const httpClient = (await import('axios')).default;
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
      httpClient: overriddenHttpClient || httpClient,
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
