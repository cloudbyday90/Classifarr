/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0
 */

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.mock('axios');
jest.mock('../config/database', () => ({
    query: jest.fn()
}));
jest.mock('../utils/logger', () => ({
    createLogger: () => mockLogger
}));

const axios = require('axios');
const { EventEmitter } = require('events');
const db = require('../config/database');
const ollamaService = require('../services/ollama');

describe('OllamaService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS;
        delete process.env.OLLAMA_PROBE_TIMEOUT_MS;
        delete process.env.OLLAMA_PREFLIGHT_RETRY_BASE_MS;
        delete process.env.OLLAMA_PREFLIGHT_RETRY_MAX_MS;
        delete process.env.OLLAMA_PREFLIGHT_WARN_DEDUPE_MS;
        ollamaService.stopScheduledPreflight();
        ollamaService.host = null;
        ollamaService.port = null;
        ollamaService.model = null;
        ollamaService.baseUrl = null;
        ollamaService.preflightCache.clear();
        ollamaService.lastScheduledPreflight = null;
        ollamaService.lastEmbeddingPreflight = null;
        ollamaService.scheduledPreflightFailureCount = 0;
        ollamaService.scheduledPreflightInFlight = false;
        ollamaService.scheduledPreflightEnabled = false;

        db.query.mockImplementation((sql) => {
            if (sql.includes('ollama_config')) {
                return Promise.resolve({ rows: [] });
            }
            if (sql.includes('ai_provider_config')) {
                return Promise.resolve({ rows: [{ ollama_host: 'localhost', ollama_port: 11434, ollama_model: 'test-model' }] });
            }
            return Promise.resolve({ rows: [] });
        });
    });

    describe('getLoadedModels', () => {
        it('should return list of currently loaded models', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [
                        { name: 'test-model:latest', size: 8589934592, digest: 'abc123' },
                        { name: 'test-embed-model', size: 274877440, digest: 'def456' }
                    ]
                }
            });

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toHaveLength(2);
            expect(models[0].name).toBe('test-model:latest');
        });

        it('should return empty array when no models loaded', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toHaveLength(0);
        });

        it('should return empty array on error (non-fatal)', async () => {
            axios.get.mockRejectedValueOnce(new Error('Connection refused'));

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toEqual([]);
        });
    });

    describe('isModelLoaded', () => {
        it('should return true when model is loaded (exact match)', async () => {
            axios.get.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('test-model:7b', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return true when model matches with tag suffix', async () => {
            axios.get.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('test-model', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return false when model is not loaded', async () => {
            axios.get.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('other-model', 'localhost', 11434);

            expect(isLoaded).toBe(false);
        });

        it('should return false when no models are loaded', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            const isLoaded = await ollamaService.isModelLoaded('test-model', 'localhost', 11434);

            expect(isLoaded).toBe(false);
        });
    });

    describe('parseCacheMs', () => {
        it('should parse string number', () => {
            expect(ollamaService.parseCacheMs('30000', 60000)).toBe(30000);
        });

        it('should return number directly', () => {
            expect(ollamaService.parseCacheMs(45000, 60000)).toBe(45000);
        });

        it('should return fallback for null', () => {
            expect(ollamaService.parseCacheMs(null, 60000)).toBe(60000);
        });

        it('should return fallback for undefined', () => {
            expect(ollamaService.parseCacheMs(undefined, 60000)).toBe(60000);
        });

        it('should return fallback for invalid string', () => {
            expect(ollamaService.parseCacheMs('invalid', 60000)).toBe(60000);
        });

        it('should return fallback for negative number', () => {
            expect(ollamaService.parseCacheMs(-1000, 60000)).toBe(60000);
        });

        it('should return fallback for NaN', () => {
            expect(ollamaService.parseCacheMs(NaN, 60000)).toBe(60000);
        });
    });

    describe('resetConfig', () => {
        it('should clear cached configuration', () => {
            ollamaService.host = 'localhost';
            ollamaService.port = 11434;
            ollamaService.baseUrl = 'http://localhost:11434';
            ollamaService.preflightCache.set('key', { success: true });

            ollamaService.resetConfig();

            expect(ollamaService.host).toBeNull();
            expect(ollamaService.port).toBeNull();
            expect(ollamaService.baseUrl).toBeNull();
            expect(ollamaService.preflightCache.size).toBe(0);
        });
    });

    describe('getDefaultOllamaHost', () => {
        it('should return localhost', () => {
            expect(ollamaService.getDefaultOllamaHost()).toBe('localhost');
        });
    });

    describe('getGenerationStatus', () => {
        it('should return inactive status when no generation', () => {
            expect(ollamaService.getGenerationStatus().isActive).toBe(false);
        });

        it('should return active status during generation', () => {
            ollamaService.setGenerationStatus(true, 'test-model', 'Test Item');

            const status = ollamaService.getGenerationStatus();

            expect(status.isActive).toBe(true);
            expect(status.model).toBe('test-model');
            expect(status.itemTitle).toBe('Test Item');
        });

        it('should return inactive after generation ends', () => {
            ollamaService.setGenerationStatus(true, 'test-model', 'Test Item');
            ollamaService.setGenerationStatus(false);

            expect(ollamaService.getGenerationStatus().isActive).toBe(false);
        });
    });

    describe('setGenerationStatus', () => {
        it('should set generation status with all fields', () => {
            ollamaService.setGenerationStatus(true, 'test-model', 'Test Item');

            expect(ollamaService.currentGeneration.isActive).toBe(true);
            expect(ollamaService.currentGeneration.model).toBe('test-model');
            expect(ollamaService.currentGeneration.itemTitle).toBe('Test Item');
        });

        it('should reset generation status when set to false', () => {
            ollamaService.setGenerationStatus(true, 'test-model', 'Test Item');
            ollamaService.setGenerationStatus(false);

            expect(ollamaService.currentGeneration.isActive).toBe(false);
        });
    });

    describe('scheduled preflight', () => {
        beforeEach(() => {
            jest.useFakeTimers();
            ollamaService.stopScheduledPreflight();
            ollamaService.lastScheduledPreflight = null;
            ollamaService.lastEmbeddingPreflight = null;
        });

        afterEach(() => {
            ollamaService.stopScheduledPreflight();
            jest.useRealTimers();
        });

        it('should start scheduled preflight timer', () => {
            ollamaService.startScheduledPreflight(60000);
            expect(ollamaService.scheduledPreflightTimer).not.toBeNull();
        });

        it('should not start duplicate timer', () => {
            ollamaService.startScheduledPreflight(60000);
            const timer1 = ollamaService.scheduledPreflightTimer;

            ollamaService.startScheduledPreflight(60000);

            expect(ollamaService.scheduledPreflightTimer).toBe(timer1);
        });

        it('should stop scheduled preflight timer', () => {
            ollamaService.startScheduledPreflight(60000);
            ollamaService.stopScheduledPreflight();

            expect(ollamaService.scheduledPreflightTimer).toBeNull();
        });

        it('should handle stop when no timer is running', () => {
            expect(() => ollamaService.stopScheduledPreflight()).not.toThrow();
        });

        it('should return null when no scheduled preflight has run', () => {
            const result = ollamaService.getLastScheduledPreflight();

            expect(result.ai).toBeNull();
            expect(result.embedding).toBeNull();
        });

        it('should retry failed scheduled preflight with backoff and recover to base interval', async () => {
            process.env.OLLAMA_PREFLIGHT_RETRY_BASE_MS = '10000';
            process.env.OLLAMA_PREFLIGHT_RETRY_MAX_MS = '60000';
            const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
            jest.spyOn(ollamaService, 'preflightConnection')
                .mockResolvedValueOnce({
                    success: false,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    error: 'Connected, but generation probe failed: timeout of 15000ms exceeded',
                    errorCode: 'ECONNABORTED',
                    failureType: 'generation_timeout'
                })
                .mockResolvedValueOnce({
                    success: true,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    models: [{ name: 'test-model' }],
                    latency_ms: 123
                });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.success).toBe(false);
            expect(ollamaService.lastScheduledPreflight.consecutiveFailures).toBe(1);
            expect(ollamaService.lastScheduledPreflight.nextAttemptInMs).toBe(5000);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Scheduled Ollama preflight failed',
                expect.objectContaining({
                    failureType: 'generation_timeout',
                    consecutiveFailures: 1,
                    nextAttemptInMs: 5000
                }),
                expect.objectContaining({
                    dedupeKey: expect.stringContaining('scheduled-preflight:localhost:11434:test-model:generation_timeout')
                })
            );

            await jest.advanceTimersByTimeAsync(5000);

            expect(ollamaService.lastScheduledPreflight.success).toBe(true);
            expect(ollamaService.lastScheduledPreflight.consecutiveFailures).toBe(0);
            expect(ollamaService.lastScheduledPreflight.nextAttemptInMs).toBe(60000);
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Scheduled Ollama preflight recovered',
                expect.objectContaining({
                    recoveredAfterFailures: 1,
                    nextScheduledAt: expect.any(String)
                })
            );

            randomSpy.mockRestore();
        });
    });

    describe('preflightCache', () => {
        it('should clear preflight cache', () => {
            ollamaService.preflightCache.set('key1', { success: true });
            ollamaService.preflightCache.set('key2', { success: false });

            ollamaService.preflightCache.clear();

            expect(ollamaService.preflightCache.size).toBe(0);
        });

        it('should store and retrieve cached values', () => {
            const cachedResult = { success: true, host: 'localhost', port: 11434 };
            ollamaService.preflightCache.set('test-key', cachedResult);

            expect(ollamaService.preflightCache.get('test-key')).toEqual(cachedResult);
        });

        it('should classify generation timeouts and use configured connectivity and probe timeouts', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'test-model' }]
                }
            });
            const timeoutError = new Error('timeout of 23000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            axios.post.mockRejectedValueOnce(timeoutError);

            const result = await ollamaService.preflightConnection({
                host: 'localhost',
                port: 11434,
                model: 'test-model',
                probeGeneration: true,
                force: true,
                connectivityTimeoutMs: 7000,
                probeTimeoutMs: 23000
            });

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ECONNABORTED');
            expect(result.failureType).toBe('generation_timeout');
            expect(axios.get).toHaveBeenCalledWith(
                'http://localhost:11434/api/tags',
                expect.objectContaining({ timeout: 7000 })
            );
            expect(axios.post).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.any(Object),
                expect.objectContaining({ timeout: 23000 })
            );
        });
    });

    describe('getRecommendedModels', () => {
        it('should return array of recommended models', () => {
            const models = ollamaService.getRecommendedModels();

            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBeGreaterThan(0);
            expect(models[0]).toHaveProperty('name');
        });
    });

    describe('warmModel with explicit host/port', () => {
        it('should successfully warm a model', async () => {
            axios.post.mockResolvedValueOnce({ data: {} });

            const result = await ollamaService.warmModel('test-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(true);
            expect(result.model).toBe('test-model');
            expect(result.keep_alive).toBe('24h');
            expect(result.host).toBe('ollama-host');
        });

        it('should return failure when model not found (404)', async () => {
            const error = new Error('Request failed with status code 404');
            axios.post.mockRejectedValueOnce(error);

            const result = await ollamaService.warmModel('nonexistent-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(false);
            expect(result.model).toBe('nonexistent-model');
            expect(result.error).toContain('404');
        });

        it('should return failure on connection error', async () => {
            const error = new Error('ECONNREFUSED');
            error.code = 'ECONNREFUSED';
            axios.post.mockRejectedValueOnce(error);

            const result = await ollamaService.warmModel('test-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ECONNREFUSED');
        });
    });

    describe('generateWithProgress stream chunk handling', () => {
        it('should parse done signal when JSON line is split across chunks', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            axios.post.mockImplementationOnce(() => {
                const stream = new EventEmitter();
                setTimeout(() => {
                    stream.emit('data', Buffer.from('{"response":"Hello"}\n{"do'));
                    stream.emit('data', Buffer.from('ne":true}\n'));
                    stream.emit('end');
                }, 0);
                return Promise.resolve({ data: stream });
            });

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: null
            };

            const result = await ollamaService.generateWithProgress(
                'test prompt',
                'gemma3:12b',
                0.3,
                null,
                controller,
                {
                    requireDoneSignal: true,
                    allowPartialOnAbort: false,
                    allowPartialOnStall: false
                }
            );

            expect(result).toBe('Hello');
        });
    });
});
