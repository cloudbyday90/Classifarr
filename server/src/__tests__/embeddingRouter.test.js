/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

var mockLogger;
const mockEmbeddingProvider = {
    resetConfig: jest.fn(),
    getConfig: jest.fn(),
    getCircuitStatus: jest.fn(),
    resetCircuit: jest.fn(),
    getCircuitStateHistory: jest.fn(),
    getSameModeProvider: jest.fn(),
    getEmbedding: jest.fn(),
    testConnection: jest.fn()
};

jest.mock('../config/database');
jest.mock('../services/ollama');
jest.mock('../services/cloudLLM');
jest.mock('../services/embeddingProvider', () => mockEmbeddingProvider);
jest.mock('../utils/logger', () => {
    mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    };

    return {
        createLogger: () => mockLogger
    };
});

jest.unstable_mockModule('../config/database.js', () => {
    const database = require('../config/database');
    return { ...database, default: database };
});

jest.unstable_mockModule('../config/database.mjs', () => {
    const database = require('../config/database');
    return { ...database, default: database };
});

jest.unstable_mockModule('../services/ollama.mjs', () => ({
    default: require('../services/ollama')
}));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({
    default: mockEmbeddingProvider
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
    default: require('../utils/logger')
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    default: require('../utils/logger')
}));

const db = require('../config/database');
const ollamaService = require('../services/ollama');
const { embeddingCircuitBreaker } = require('../services/embeddingCircuitBreaker');
const embeddingProvider = mockEmbeddingProvider;

let embeddingRouter;

beforeAll(async () => {
    ({ default: embeddingRouter } = await import('../services/embeddingRouter.mjs'));
});

describe('EmbeddingRouter', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        embeddingProvider.getCircuitStatus.mockImplementation(() => embeddingCircuitBreaker.getStatus());
        embeddingProvider.resetCircuit.mockImplementation(() => embeddingCircuitBreaker.reset());
        embeddingProvider.getCircuitStateHistory.mockImplementation((limit) => embeddingCircuitBreaker.getStateHistory(limit));
        embeddingProvider.getSameModeProvider.mockImplementation((config = {}) => ({
            provider: config.primary_provider || 'ollama',
            model: config.embedding_model || 'nomic-embed-text-v2-moe'
        }));
        embeddingRouter.resetCircuit();
    });

    describe('embed', () => {
        it('delegates primary embedding execution to embeddingProvider', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'same'
            });
            embeddingProvider.getEmbedding.mockResolvedValue({
                embedding: [0.1, 0.2, 0.3],
                dims: 3,
                provider: 'ollama',
                model: 'test-model',
                cost: 0
            });

            const result = await embeddingRouter.embed('test text');

            expect(embeddingProvider.getEmbedding).toHaveBeenCalledWith('test text', { signal: null });
            expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
        });

        it('uses Ollama fallback when primary execution fails and fallback is configured', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'cloud',
                ollama_fallback_enabled: true
            });
            embeddingProvider.getEmbedding.mockRejectedValue(new Error('cloud timeout'));
            ollamaService.embed.mockResolvedValue({ embedding: [0.9, 0.8], dims: 2 });

            const result = await embeddingRouter.embed('cloud text');

            expect(ollamaService.embed).toHaveBeenCalledWith('cloud text', 'nomic-embed-text-v2-moe', '5m', null);
            expect(result.embedding).toEqual([0.9, 0.8]);
            expect(result.fallback).toBe(true);
        });

        it('should handle errors and throw', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'same',
                ollama_fallback_enabled: false
            });
            embeddingProvider.getEmbedding.mockRejectedValue(new Error('Config Error'));

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
        it('circuit breaker instance is named TextEmbedding for per-instance logging (Gap 3.22)', () => {
            expect(embeddingCircuitBreaker.name).toBe('TextEmbedding');
        });

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
            expect(status.lastFailure).toBeNull();
        });

        it('logs circuit breaker opened only once per open transition', () => {
            for (let i = 0; i < 5; i++) {
                embeddingRouter.recordFailure(new Error(`failure ${i + 1}`));
            }

            embeddingRouter.recordFailure(new Error('repeated half-open failure'));

            expect(mockLogger.warn).toHaveBeenCalledTimes(1);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Circuit breaker opened',
                expect.objectContaining({ failures: 5 }),
                { skipDbPersist: true }
            );
        });
    });

    describe('open circuit handling', () => {
        it('throws a cooldown error when circuit is open without a usable fallback', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'same',
                ollama_fallback_enabled: false
            });
            embeddingProvider.getSameModeProvider.mockReturnValue({
                provider: 'ollama',
                model: 'nomic-embed-text'
            });

            for (let i = 0; i < 5; i++) {
                embeddingRouter.recordFailure(new Error('provider down'));
            }

            await expect(embeddingRouter.embed('test text')).rejects.toThrow(
                'Circuit breaker is OPEN - embedding provider cooldown active'
            );
            expect(ollamaService.embed).not.toHaveBeenCalled();
        });

        it('uses Ollama fallback when circuit is open for a non-Ollama provider', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'same',
                ollama_fallback_enabled: true
            });
            embeddingProvider.getSameModeProvider.mockReturnValue({
                provider: 'openai',
                model: 'text-embedding-3-small',
                config: { api_key: 'key' }
            });
            ollamaService.embed.mockResolvedValue({ embedding: [0.1, 0.2], dims: 2 });

            for (let i = 0; i < 5; i++) {
                embeddingRouter.recordFailure(new Error('cloud timeout'));
            }

            const result = await embeddingRouter.embed('test text');

            expect(ollamaService.embed).toHaveBeenCalledWith('test text', 'nomic-embed-text-v2-moe', '5m', null);
            expect(result).toMatchObject({
                provider: 'ollama',
                model: 'nomic-embed-text-v2-moe',
                fallback: true
            });
        });

        it('does not record circuit failures for configuration errors from embeddingProvider', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'cloud',
                ollama_fallback_enabled: false
            });

            const configError = new Error('No API key configured');
            configError.name = 'ConfigurationError';
            configError.isConfigurationError = true;
            embeddingProvider.getEmbedding.mockRejectedValue(configError);

            await expect(embeddingRouter.embed('test text')).rejects.toThrow('No API key configured');
            expect(embeddingRouter.getCircuitStatus().failures).toBe(0);
        });
    });

    describe('embed — Issue #330 AbortError and cloud-circuit fallback', () => {
        it('AbortError from primary provider propagates without attempting Ollama fallback', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'cloud',
                ollama_fallback_enabled: true
            });
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            embeddingProvider.getEmbedding.mockRejectedValue(abortError);

            await expect(embeddingRouter.embed('test')).rejects.toMatchObject({ name: 'AbortError' });
            expect(ollamaService.embed).not.toHaveBeenCalled();
        });

        it('AbortError from Ollama fallback propagates without logging "Fallback embedding also failed"', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'cloud',
                ollama_fallback_enabled: true
            });
            embeddingProvider.getEmbedding.mockRejectedValue(new Error('cloud timeout'));
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            ollamaService.embed.mockRejectedValue(abortError);

            await expect(embeddingRouter.embed('test')).rejects.toMatchObject({ name: 'AbortError' });
            expect(mockLogger.error).not.toHaveBeenCalledWith(
                'Fallback embedding also failed',
                expect.anything()
            );
        });

        it('cloud mode: CIRCUIT_OPEN error from embeddingProvider routes to Ollama fallback when ollama_fallback_enabled', async () => {
            jest.spyOn(embeddingRouter, 'isEnabled').mockResolvedValue(true);
            jest.spyOn(embeddingRouter, 'getConfig').mockResolvedValue({
                rag_enabled: true,
                embedding_provider_mode: 'cloud',
                ollama_fallback_enabled: true
            });
            const circuitError = new Error('Circuit breaker is OPEN - embedding provider cooldown active');
            circuitError.code = 'EMBEDDING_CIRCUIT_OPEN';
            embeddingProvider.getEmbedding.mockRejectedValue(circuitError);
            ollamaService.embed.mockResolvedValue({ embedding: [0.5, 0.6], dims: 2 });

            const result = await embeddingRouter.embed('test text');

            expect(ollamaService.embed).toHaveBeenCalledWith('test text', 'nomic-embed-text-v2-moe', '5m', null);
            expect(result).toMatchObject({ provider: 'ollama', model: 'nomic-embed-text-v2-moe', fallback: true });
        });
    });
});
