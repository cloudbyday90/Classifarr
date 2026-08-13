import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const persistAiSettingsConfig = jest.fn();
const finalizeAiSettingsResponseConfig = jest.fn();
const createAiSettingsActionService = jest.fn(() => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetUsage: jest.fn(),
}));
const createAiSettingsReadService = jest.fn(() => ({
  getConfig: jest.fn(),
  getConfigWithWritePrecondition: jest.fn(),
  getUsageSummary: jest.fn(),
  getUsageFallback: jest.fn(),
  getStatus: jest.fn(),
}));

jest.unstable_mockModule('../routes/helpers/aiSettingsPersistence.mjs', () => ({
  persistAiSettingsConfig,
}));

jest.unstable_mockModule('../routes/helpers/aiSettingsResponseSupport.mjs', () => ({
  finalizeAiSettingsResponseConfig,
}));

jest.unstable_mockModule('../services/aiSettingsActionService.mjs', () => ({
  createAiSettingsActionService,
}));

jest.unstable_mockModule('../services/aiSettingsReadService.mjs', () => ({
  createAiSettingsReadService,
}));

const { createAiSettingsHandlers } = await import('../routes/helpers/aiSettingsHandlers.mjs');

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

function resetAiSettingsHandlerModuleMocks() {
  persistAiSettingsConfig.mockReset();
  finalizeAiSettingsResponseConfig.mockReset();
  createAiSettingsActionService.mockReset();
  createAiSettingsReadService.mockReset();

  createAiSettingsActionService.mockReturnValue({
    testConnection: jest.fn(),
    getModels: jest.fn(),
    resetUsage: jest.fn(),
  });
  createAiSettingsReadService.mockReturnValue({
    getConfig: jest.fn(),
    getConfigWithWritePrecondition: jest.fn(),
    getUsageSummary: jest.fn(),
    getUsageFallback: jest.fn(),
    getStatus: jest.fn(),
  });
}

describe('aiSettingsHandlers', () => {
  beforeEach(() => {
    resetAiSettingsHandlerModuleMocks();
  });

  test('updateConfig preserves a successful response when runtime refresh fails after persistence', async () => {
    const persistedConfig = {
      model: 'gpt-5.4',
      configuration_write_tag: '00000000-0000-4000-8000-000000000101',
    };
    persistAiSettingsConfig.mockResolvedValue({
      config: persistedConfig,
      effects: { textEmbeddingsCleared: false },
    });

    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    const db = {
      withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
    };
    const backfillOrchestratorService = {
      maybeStartIdleBackfill: jest.fn(),
    };
    const handlers = createAiSettingsHandlers({
      db,
      logger,
      cloudLLMService: {},
      aiRouterService: {
        clearCache: jest.fn(() => {
          throw new Error('router cache failed');
        }),
      },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      backfillOrchestratorService,
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
      parseEncryptedValue: jest.fn(),
      decryptValue: jest.fn(),
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { model: 'gpt-5.4' }, user: { id: 1 } }, res);

    expect(res.json).toHaveBeenCalledWith(persistedConfig);
    expect(finalizeAiSettingsResponseConfig).toHaveBeenCalledWith({
      config: persistedConfig,
      parseEncryptedValue: expect.any(Function),
      decryptValue: expect.any(Function),
    });
    expect(logger.warn).toHaveBeenCalledWith('Settings runtime refresh failed after config update', {
      context: 'ai-settings',
      action: 'ai-router-cache',
      error: 'router cache failed',
    });
    expect(backfillOrchestratorService.maybeStartIdleBackfill).not.toHaveBeenCalled();
  });

  test('updateConfig forwards formula-weight extras in the error response', async () => {
    const error = new Error('invalid weights');
    error.currentSum = 1.2;
    persistAiSettingsConfig.mockRejectedValue(error);

    const handlers = createAiSettingsHandlers({
      db: {
        withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
      },
      logger: {
        warn: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { formula_pattern_weight: 0.5 }, user: { id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid weights',
      currentSum: 1.2,
    });
  });

  test('updateConfig returns a bounded stale-write result without refreshing runtime state', async () => {
    const staleWriteError = new Error('AI settings changed before this save.');
    staleWriteError.code = 'ai_settings_stale_write';
    staleWriteError.httpStatus = 412;
    staleWriteError.reloadRequired = true;
    persistAiSettingsConfig.mockRejectedValue(staleWriteError);

    const aiRouterService = { clearCache: jest.fn() };
    const ollamaService = { resetConfig: jest.fn() };
    const embeddingProvider = { resetConfig: jest.fn() };
    const embeddingRouter = { resetConfig: jest.fn() };
    const backfillOrchestratorService = { maybeStartIdleBackfill: jest.fn() };
    const handlers = createAiSettingsHandlers({
      db: {
        withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
      },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cloudLLMService: {},
      aiRouterService,
      ollamaService,
      embeddingProvider,
      embeddingRouter,
      backfillOrchestratorService,
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
    });
    const res = createResponse();
    const req = {
      body: { model: 'gemini-2.5-pro' },
      user: { id: 1 },
      get: jest.fn((headerName) => (
        headerName === 'If-Match' ? '"00000000-0000-4000-8000-000000000410"' : undefined
      )),
    };

    await handlers.updateConfig(req, res);

    expect(persistAiSettingsConfig).toHaveBeenCalledWith(expect.objectContaining({
      providedWritePrecondition: '"00000000-0000-4000-8000-000000000410"',
    }));
    expect(res.status).toHaveBeenCalledWith(412);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({
      error: 'AI settings changed before this save.',
      code: 'ai_settings_stale_write',
      reload_required: true,
    });
    expect(aiRouterService.clearCache).not.toHaveBeenCalled();
    expect(ollamaService.resetConfig).not.toHaveBeenCalled();
    expect(embeddingProvider.resetConfig).not.toHaveBeenCalled();
    expect(embeddingRouter.resetConfig).not.toHaveBeenCalled();
    expect(backfillOrchestratorService.maybeStartIdleBackfill).not.toHaveBeenCalled();
  });

  test('updateConfig triggers non-fatal idle backfill reconcile when text embeddings were cleared', async () => {
    const persistedConfig = {
      model: 'mxbai-embed-large',
      configuration_write_tag: '00000000-0000-4000-8000-000000000102',
    };
    const backfillOrchestratorService = {
      maybeStartIdleBackfill: jest.fn().mockRejectedValue(new Error('reconcile failed')),
    };
    persistAiSettingsConfig.mockResolvedValue({
      config: persistedConfig,
      effects: { textEmbeddingsCleared: true },
    });

    const logger = {
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    const handlers = createAiSettingsHandlers({
      db: {
        withTransaction: jest.fn(async (callback) => callback({ query: jest.fn() })),
      },
      logger,
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      backfillOrchestratorService,
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
      parseEncryptedValue: jest.fn(),
      decryptValue: jest.fn(),
    });
    const res = createResponse();

    await handlers.updateConfig({ body: { embedding_provider_mode: 'cloud' }, user: { id: 1 } }, res);

    expect(backfillOrchestratorService.maybeStartIdleBackfill).toHaveBeenCalledWith('ai_settings_embedding_identity_change');
    expect(logger.warn).toHaveBeenCalledWith('RAG backfill reconcile failed after AI settings update', {
      error: 'reconcile failed',
    });
    expect(res.json).toHaveBeenCalledWith(persistedConfig);
  });

  test('getVerificationCapability reads the saved capability projection without a proposal', async () => {
    const getPreflight = jest.fn().mockResolvedValue({
      statusId: 'verification_ready',
      label: 'Strict verification is available',
    });
    const handlers = createAiSettingsHandlers({
      db: { withTransaction: jest.fn() },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
      candidateBoundVerificationProviderPreflightService: { getPreflight },
    });
    const res = createResponse();

    await handlers.getVerificationCapability({}, res);

    expect(getPreflight).toHaveBeenCalledWith({
      presentationContext: 'saved_configuration',
    });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({
      statusId: 'verification_ready',
      label: 'Strict verification is available',
    });
  });

  test('does not construct receipt reads while unrelated settings handlers are used', async () => {
    const getConfigWithWritePrecondition = jest.fn().mockResolvedValue({
      config: { primary_provider: 'none' },
      writePrecondition: '"00000000-0000-4000-8000-000000000103"',
    });
    createAiSettingsReadService.mockReturnValueOnce({
      getConfigWithWritePrecondition,
      getUsageSummary: jest.fn(),
      getUsageFallback: jest.fn(),
      getStatus: jest.fn(),
    });
    const handlers = createAiSettingsHandlers({
      db: { query: jest.fn() },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
    });
    const res = createResponse();

    await handlers.getConfig({}, res);

    expect(getConfigWithWritePrecondition).toHaveBeenCalledTimes(1);
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.set).toHaveBeenCalledWith('ETag', '"00000000-0000-4000-8000-000000000103"');
    expect(res.json).toHaveBeenCalledWith({ primary_provider: 'none' });
  });

  test('getVerificationCapabilityChangeReceipts derives the actor from the authenticated request', async () => {
    const list = jest.fn().mockResolvedValue({ receipts: [] });
    const handlers = createAiSettingsHandlers({
      db: { withTransaction: jest.fn() },
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
      verificationCapabilityChangeReceiptRepository: { record: jest.fn(), listForActor: jest.fn() },
      verificationCapabilityChangeReceiptReadService: { list },
    });
    const res = createResponse();

    await handlers.getVerificationCapabilityChangeReceipts({
      user: { id: 42 },
      query: { limit: '5' },
    }, res);

    expect(list).toHaveBeenCalledWith({ actorId: 'user:42', query: { limit: '5' } });
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.json).toHaveBeenCalledWith({ receipts: [] });
  });

  test('updateConfig rejects a missing stable actor before opening a settings transaction', async () => {
    const db = { withTransaction: jest.fn() };
    const handlers = createAiSettingsHandlers({
      db,
      logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
      cloudLLMService: {},
      aiRouterService: { clearCache: jest.fn() },
      ollamaService: { resetConfig: jest.fn() },
      embeddingProvider: { resetConfig: jest.fn() },
      embeddingRouter: { resetConfig: jest.fn() },
      getRagLoopDefaultConfig: jest.fn(() => ({})),
      validateAndNormalizeRagLoopConfig: jest.fn(() => ({ normalizedConfig: {}, warnings: [] })),
      validateRagLoopConfigPayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
      resolveRequestApiKey: jest.fn(),
    });
    const res = createResponse();

    await expect(handlers.updateConfig({ body: { model: 'gemini-2.5-pro' } }, res)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
});
