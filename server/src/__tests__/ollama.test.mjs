/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 * Licensed under GPL-3.0
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
const mockHttpStream = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: mockHttpStream,
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockLoggerModule = {
    createLogger: jest.fn(() => mockLogger)
};

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const db = mockDb;
const { ollamaService } = await import('../services/ollama.mjs');

describe('OllamaService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OLLAMA_CONNECTIVITY_TIMEOUT_MS;
        delete process.env.OLLAMA_PROBE_TIMEOUT_MS;
        delete process.env.OLLAMA_PROBE_CONTEXT_LENGTH;
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
            mockHttpGet.mockResolvedValueOnce({
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
            mockHttpGet.mockResolvedValueOnce({ data: { models: [] } });

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toHaveLength(0);
        });

        it('should return empty array on error (non-fatal)', async () => {
            mockHttpGet.mockRejectedValueOnce(new Error('Connection refused'));

            const models = await ollamaService.getLoadedModels('localhost', 11434);

            expect(models).toEqual([]);
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Failed to get loaded models',
                { error: 'Connection refused' },
                expect.objectContaining({
                    dedupeKey: expect.stringContaining('ai-provider-runtime:loaded_models_failed:localhost:11434:'),
                })
            );
        });
    });

    describe('isModelLoaded', () => {
        it('should return true when model is loaded (exact match)', async () => {
            mockHttpGet.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('test-model:7b', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return true when model matches with tag suffix', async () => {
            mockHttpGet.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('test-model', 'localhost', 11434);

            expect(isLoaded).toBe(true);
        });

        it('should return false when model is not loaded', async () => {
            mockHttpGet.mockResolvedValueOnce({
                data: { models: [{ name: 'test-model:7b' }] }
            });

            const isLoaded = await ollamaService.isModelLoaded('other-model', 'localhost', 11434);

            expect(isLoaded).toBe(false);
        });

        it('should return false when no models are loaded', async () => {
            mockHttpGet.mockResolvedValueOnce({ data: { models: [] } });

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
            db.query.mockReset();
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

        it('should skip preflight when Ollama is not the active provider', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'openai', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.skipped).toBe(true);
            expect(ollamaService.lastScheduledPreflight.reason).toBe('ollama_not_configured');
            expect(ollamaService.lastScheduledPreflight.host).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Ollama is not the active provider')
            );
        });

        it('should skip preflight when primary provider is none', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'none', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.skipped).toBe(true);
            expect(ollamaService.lastScheduledPreflight.reason).toBe('ollama_not_configured');
        });

        it('should run preflight when Ollama is the primary provider', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'ollama', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            jest.spyOn(ollamaService, 'preflightConnection')
                .mockResolvedValueOnce({
                    success: true,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    models: [{ name: 'test-model' }],
                    latency_ms: 50
                });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.success).toBe(true);
        });

        it('should run preflight when Ollama fallback is enabled', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'openai', ollama_fallback_enabled: true, embedding_provider_mode: 'same' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            jest.spyOn(ollamaService, 'preflightConnection')
                .mockResolvedValueOnce({
                    success: true,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    models: [{ name: 'test-model' }],
                    latency_ms: 50
                });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.success).toBe(true);
        });

        it('should run preflight when embedding_provider_mode is separate_ollama', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'openai', ollama_fallback_enabled: false, embedding_provider_mode: 'separate_ollama' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            jest.spyOn(ollamaService, 'preflightConnection')
                .mockResolvedValueOnce({
                    success: true,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    models: [{ name: 'test-model' }],
                    latency_ms: 50
                });

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(ollamaService.lastScheduledPreflight.success).toBe(true);
        });

        it('should retry failed scheduled preflight with backoff and recover to base interval', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'ollama', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'ollama', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            process.env.OLLAMA_PREFLIGHT_RETRY_BASE_MS = '10000';
            process.env.OLLAMA_PREFLIGHT_RETRY_MAX_MS = '60000';
            const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
            jest.spyOn(ollamaService, 'preflightConnection')
                .mockResolvedValueOnce({
                    success: false,
                    host: 'localhost',
                    port: 11434,
                    model: 'test-model',
                    error: 'Connected, but generation probe failed: timeout of 120000ms exceeded',
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

        it('dedupes hard scheduled preflight errors with a runtime key', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ primary_provider: 'ollama', ollama_fallback_enabled: false, embedding_provider_mode: 'same' }]
            });
            db.query.mockResolvedValueOnce({
                rows: [{ host: 'localhost', port: 11434, model: 'test-model' }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            jest.spyOn(ollamaService, 'preflightConnection').mockRejectedValueOnce(new Error('probe crash'));

            ollamaService.startScheduledPreflight(60000);

            await jest.advanceTimersByTimeAsync(60000);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Scheduled Ollama preflight error',
                expect.objectContaining({
                    error: 'probe crash',
                    failureType: expect.any(String),
                }),
                expect.objectContaining({
                    dedupeKey: expect.stringContaining('ai-provider-runtime:scheduled_preflight_error:'),
                })
            );
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

        it('should classify generation timeouts and use configured connectivity, probe timeout, and compact probe context', async () => {
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'test-model' }]
                }
            });
            const timeoutError = new Error('timeout of 23000ms exceeded');
            timeoutError.code = 'ECONNABORTED';
            mockHttpPost.mockRejectedValueOnce(timeoutError);

            const result = await ollamaService.preflightConnection({
                host: 'localhost',
                port: 11434,
                model: 'test-model',
                probeGeneration: true,
                force: true,
                connectivityTimeoutMs: 7000,
                probeTimeoutMs: 23000,
                probeContextLength: 2048
            });

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ECONNABORTED');
            expect(result.failureType).toBe('generation_timeout');
            expect(result.checks.generation_probe.num_ctx).toBe(2048);
            expect(mockHttpGet).toHaveBeenCalledWith(
                'http://localhost:11434/api/tags',
                expect.objectContaining({ timeout: 7000 })
            );
            expect(mockHttpPost).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.objectContaining({
                    options: expect.objectContaining({
                        num_ctx: 2048,
                        num_predict: 4,
                        temperature: 0
                    })
                }),
                expect.objectContaining({ timeout: 23000 })
            );
        });

        it('uses a small default num_ctx for generation probes when no override is supplied', async () => {
            mockHttpGet.mockResolvedValueOnce({
                data: {
                    models: [{ name: 'test-model' }]
                }
            });
            mockHttpPost.mockResolvedValueOnce({
                data: {
                    model: 'test-model',
                    response: 'OK',
                    done: true,
                }
            });

            const result = await ollamaService.preflightConnection({
                host: 'localhost',
                port: 11434,
                model: 'test-model',
                probeGeneration: true,
                force: true
            });

            expect(result.success).toBe(true);
            expect(result.checks.generation_probe.num_ctx).toBe(4096);
            expect(mockHttpPost).toHaveBeenCalledWith(
                'http://localhost:11434/api/generate',
                expect.objectContaining({
                    options: expect.objectContaining({
                        num_ctx: 4096
                    })
                }),
                expect.any(Object)
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
            mockHttpPost.mockResolvedValueOnce({ data: {} });

            const result = await ollamaService.warmModel('test-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(true);
            expect(result.model).toBe('test-model');
            expect(result.keep_alive).toBe('24h');
            expect(result.host).toBe('ollama-host');
        });

        it('should return failure when model not found (404)', async () => {
            const error = new Error('Request failed with status code 404');
            mockHttpPost.mockRejectedValueOnce(error);

            const result = await ollamaService.warmModel('nonexistent-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(false);
            expect(result.model).toBe('nonexistent-model');
            expect(result.error).toContain('404');
        });

        it('should return failure on connection error', async () => {
            const error = new Error('ECONNREFUSED');
            error.code = 'ECONNREFUSED';
            mockHttpPost.mockRejectedValueOnce(error);

            const result = await ollamaService.warmModel('test-model', '24h', 'ollama-host', 11434);

            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('ECONNREFUSED');
        });
    });

    describe('generateWithProgress stream chunk handling', () => {
        it('should parse done signal when JSON line is split across chunks', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            async function* makeStream() {
                yield Buffer.from('{"response":"Hello"}\n{"do');
                yield Buffer.from('ne":true}\n');
            }
            mockHttpStream.mockResolvedValueOnce({ body: makeStream() });

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

        it('should return response when requireDoneSignal is false and no done chunk arrives', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            async function* makeStream() {
                yield Buffer.from('{"response":"Partial"}\n');
            }
            mockHttpStream.mockResolvedValueOnce({ body: makeStream() });

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
                { requireDoneSignal: false }
            );

            expect(result).toBe('Partial');
        });

        it('should throw IncompleteStreamError when requireDoneSignal is true and done never arrives', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            async function* makeStream() {
                yield Buffer.from('{"response":"Partial text"}\n');
            }
            mockHttpStream.mockResolvedValueOnce({ body: makeStream() });

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: null
            };

            await expect(
                ollamaService.generateWithProgress(
                    'test prompt',
                    'gemma3:12b',
                    0.3,
                    null,
                    controller,
                    { requireDoneSignal: true }
                )
            ).rejects.toMatchObject({
                name: 'IncompleteStreamError',
                code: 'EINCOMPLETE',
                partialResponse: 'Partial text',
            });
        });

        it('should throw when stream yields no response content', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            async function* makeStream() {
                yield Buffer.from('{"done":true}\n');
            }
            mockHttpStream.mockResolvedValueOnce({ body: makeStream() });

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: null
            };

            await expect(
                ollamaService.generateWithProgress(
                    'test prompt',
                    'gemma3:12b',
                    0.3,
                    null,
                    controller,
                    {}
                )
            ).rejects.toThrow('Empty response from model');
        });

        it('should return partial result on abort when allowPartialOnAbort is true', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            abortError.code = 'ABORT_ERR';
            mockHttpStream.mockRejectedValueOnce(abortError);

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: 'partial text so far',
            };

            const result = await ollamaService.generateWithProgress(
                'test prompt',
                'gemma3:12b',
                0.3,
                null,
                controller,
                { allowPartialOnAbort: true }
            );

            expect(result).toBe('partial text so far');
        });

        it('should throw AbortError with partialResponse when allowPartialOnAbort is false', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            abortError.code = 'ABORT_ERR';
            mockHttpStream.mockRejectedValueOnce(abortError);

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: 'partial text so far',
            };

            await expect(
                ollamaService.generateWithProgress(
                    'test prompt',
                    'gemma3:12b',
                    0.3,
                    null,
                    controller,
                    { allowPartialOnAbort: false }
                )
            ).rejects.toMatchObject({
                name: 'AbortError',
                code: 'ABORT_ERR',
                partialResponse: 'partial text so far',
            });
        });

        it('should throw AbortError without partialResponse when controller has no partial result', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({ success: true });

            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            abortError.code = 'ABORT_ERR';
            mockHttpStream.mockRejectedValueOnce(abortError);

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: null,
            };

            await expect(
                ollamaService.generateWithProgress(
                    'test prompt',
                    'gemma3:12b',
                    0.3,
                    null,
                    controller,
                    { allowPartialOnAbort: false }
                )
            ).rejects.toMatchObject({
                name: 'AbortError',
                message: 'Generation aborted',
            });
        });

        it('should throw when preflight fails before streaming', async () => {
            jest.spyOn(ollamaService, 'preflightConnection').mockResolvedValue({
                success: false,
                error: 'Connection refused',
            });

            const controller = {
                signal: undefined,
                recordActivity: jest.fn(),
                partialResult: null,
            };

            await expect(
                ollamaService.generateWithProgress(
                    'test prompt',
                    'gemma3:12b',
                    0.3,
                    null,
                    controller,
                    {}
                )
            ).rejects.toThrow('Connection refused');
        });
    });
});
