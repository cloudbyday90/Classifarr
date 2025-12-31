const embeddingRouter = require('../services/embeddingRouter');
const db = require('../config/database');
const ollamaService = require('../services/ollama');
const cloudLLMService = require('../services/cloudLLM');

jest.mock('../config/database');
jest.mock('../services/ollama');
jest.mock('../services/cloudLLM');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('EmbeddingRouter', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        // Reset cache
        embeddingRouter.providerCache = null;
        embeddingRouter.capabilitiesCache = {};
    });

    describe('getProvider', () => {
        it('should return null if no DB config', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const config = await embeddingRouter.getProvider();
            expect(config).toBeNull();
        });

        it('should return configured provider', async () => {
            db.query.mockResolvedValue({
                rows: [{
                    embedding_provider: 'openai', // Correct column name
                    embedding_model: 'text-embedding-3-small',
                    api_key: 'sk-test',
                    is_active: true,
                    rag_enabled: true
                }]
            });

            const config = await embeddingRouter.getProvider();

            expect(config.provider).toBe('openai');
            expect(config.model).toBe('text-embedding-3-small');
        });
    });

    describe('embed', () => {
        it('should route to Ollama', async () => {
            // Mock isEnabled to true
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);

            const mockConfig = { provider: 'ollama', model: 'test-model' };
            jest.spyOn(embeddingRouter, 'getProvider').mockResolvedValue(mockConfig);

            ollamaService.embed.mockResolvedValue({ embedding: [0.1, 0.2, 0.3], dims: 3 });

            const result = await embeddingRouter.embed('test text');

            expect(ollamaService.embed).toHaveBeenCalledWith('test text', 'test-model');
            expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
        });

        it('should route to CloudLLM (OpenAI)', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);

            const mockConfig = {
                provider: 'openai',
                model: 'gpt-embed',
                config: { api_key: 'key' } // Nested config 
            };
            jest.spyOn(embeddingRouter, 'getProvider').mockResolvedValue(mockConfig);

            cloudLLMService.embed.mockResolvedValue({ embedding: [0.9, 0.8], dims: 2, cost: 0.01 });

            const result = await embeddingRouter.embed('cloud text');

            // Expect correct params extraction
            expect(cloudLLMService.embed).toHaveBeenCalledWith('cloud text', mockConfig.config, 'gpt-embed');
            expect(result.embedding).toEqual([0.9, 0.8]);
        });

        it('should handle errors and throw', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getProvider').mockRejectedValue(new Error('Config Error'));

            await expect(embeddingRouter.embed('fail')).rejects.toThrow('Config Error');
        });

        it('should throw when RAG is not enabled', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(false);

            await expect(embeddingRouter.embed('test')).rejects.toThrow('RAG is not enabled');
        });
    });

    describe('isEnabled', () => {
        it('should return true when rag_enabled is true', async () => {
            // Spy on getConfig to return expected value directly
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValueOnce({ rag_enabled: true });

            const enabled = await embeddingRouter.isEnabled();
            expect(enabled).toBe(true);
        });

        it('should return false when no config exists', async () => {
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValueOnce(null);

            const enabled = await embeddingRouter.isEnabled();
            expect(enabled).toBe(false);
        });

        it('should return false when rag_enabled is false', async () => {
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValueOnce({ rag_enabled: false });

            const enabled = await embeddingRouter.isEnabled();
            expect(enabled).toBe(false);
        });
    });

    describe('getConfig', () => {
        it('should return config from database', async () => {
            const mockConfig = {
                rag_enabled: true,
                embedding_provider: 'ollama',
                rag_similarity_threshold: 0.75
            };
            db.query.mockResolvedValue({ rows: [mockConfig] });

            const config = await embeddingRouter.getConfig();

            expect(config).toEqual(mockConfig);
        });

        it('should return null on error', async () => {
            db.query.mockRejectedValue(new Error('DB Error'));

            const config = await embeddingRouter.getConfig();

            expect(config).toBeNull();
        });
    });

    describe('circuit breaker', () => {
        it('isCircuitOpen should return false when state is CLOSED', () => {
            const status = embeddingRouter.getCircuitStatus();
            expect(status.state).toBe('CLOSED');
            expect(embeddingRouter.isCircuitOpen()).toBe(false);
        });

        it('recordFailure should increment failure count', () => {
            const initialStatus = embeddingRouter.getCircuitStatus();
            const initialFailures = initialStatus.failures;

            embeddingRouter.recordFailure();

            const newStatus = embeddingRouter.getCircuitStatus();
            expect(newStatus.failures).toBe(initialFailures + 1);
        });

        it('resetCircuit should clear failures', () => {
            embeddingRouter.recordFailure();
            embeddingRouter.resetCircuit();

            const status = embeddingRouter.getCircuitStatus();
            expect(status.failures).toBe(0);
            expect(status.state).toBe('CLOSED');
        });
    });

    describe('getRecommendedModels', () => {
        it('should return models for all providers', () => {
            const models = embeddingRouter.getRecommendedModels();

            expect(models).toHaveProperty('ollama');
            expect(models).toHaveProperty('openai');
            expect(models).toHaveProperty('gemini');
            expect(models.ollama.length).toBeGreaterThan(0);
        });
    });
});
