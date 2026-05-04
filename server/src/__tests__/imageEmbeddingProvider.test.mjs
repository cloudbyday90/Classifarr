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

import { jest } from '@jest/globals';

const mockAxios = {
    post: jest.fn(),
    get: jest.fn()
};

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
};
const mockLoggerModule = { createLogger: () => mockLogger };

const mockEncryption = {
    decryptValue: jest.fn((v) => (v ? `decrypted:${v}` : null)),
    parseEncryptedValue: jest.fn((v) => ({ encrypted: v, iv: 'test-iv', authTag: 'test-tag' }))
};

const mockCB = {
    state: 'CLOSED',
    recoveryTimeout: 60000,
    run: jest.fn(async (fn) => fn()),
    reset: jest.fn(),
    isAllowed: jest.fn(() => true),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn()
};
const MockCircuitBreaker = jest.fn(() => mockCB);
MockCircuitBreaker._instance = mockCB;

const mockDb = { query: jest.fn() };

jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => ({ default: mockAxios }));

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.mock('../utils/logger', () => mockLoggerModule);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLoggerModule, default: mockLoggerModule }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLoggerModule, default: mockLoggerModule }));

jest.mock('../utils/encryption', () => mockEncryption);
jest.unstable_mockModule('../utils/encryption', () => ({ ...mockEncryption, default: mockEncryption }));
jest.unstable_mockModule('../utils/encryption.mjs', () => ({ ...mockEncryption, default: mockEncryption }));

jest.mock('../services/circuitBreaker', () => MockCircuitBreaker);
jest.unstable_mockModule('../services/circuitBreaker', () => ({ default: MockCircuitBreaker }));
jest.unstable_mockModule('../services/circuitBreaker.mjs', () => ({ default: MockCircuitBreaker }));

const { default: imageEmbeddingProvider } = await import('../services/imageEmbeddingProvider.mjs');
const axios = mockAxios;
const db = mockDb;

describe('ImageEmbeddingProvider', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        mockEncryption.decryptValue.mockImplementation((v) => (v ? `decrypted:${v}` : null));
        mockEncryption.parseEncryptedValue.mockImplementation((v) => ({ encrypted: v, iv: 'test-iv', authTag: 'test-tag' }));
        mockCB.run.mockImplementation(async (fn) => fn());
        mockCB.state = 'CLOSED';
        imageEmbeddingProvider.resetConfig();
    });

    describe('normalizeMode', () => {
        it('normalizes supported modes', () => {
            expect(imageEmbeddingProvider.normalizeMode('cloud')).toBe('cloud');
            expect(imageEmbeddingProvider.normalizeMode('LOCAL')).toBe('separate_local');
            expect(imageEmbeddingProvider.normalizeMode('separate_local')).toBe('separate_local');
            expect(imageEmbeddingProvider.normalizeMode('disabled')).toBe('disabled');
        });

        it('defaults to disabled for unknown modes', () => {
            expect(imageEmbeddingProvider.normalizeMode('same')).toBe('disabled');
            expect(imageEmbeddingProvider.normalizeMode(null)).toBe('disabled');
        });
    });

    describe('getEffectiveModel', () => {
        it('returns cloud defaults based on provider', () => {
            expect(imageEmbeddingProvider.getEffectiveModel({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'voyage'
            })).toBe('voyage-multimodal-3.5');

            expect(imageEmbeddingProvider.getEffectiveModel({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'cohere'
            })).toBe('embed-english-v3.0');

            expect(imageEmbeddingProvider.getEffectiveModel({
                image_embedding_provider_mode: 'cloud',
                image_embedding_cloud_provider: 'vertex_ai'
            })).toBe('multimodalembedding@001');
        });

        it('returns local model fallback when none provided', () => {
            expect(imageEmbeddingProvider.getEffectiveModel({
                image_embedding_provider_mode: 'separate_local'
            })).toBe('ViT-B-16');
        });

        it('returns null when disabled', () => {
            expect(imageEmbeddingProvider.getEffectiveModel({
                image_embedding_provider_mode: 'disabled'
            })).toBeNull();
        });
    });

    describe('embedLocal', () => {
        it('uses response dims when provided', async () => {
            axios.post.mockResolvedValueOnce({
                data: { embedding: [0.1, 0.2], dims: 768 }
            });

            const result = await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'localhost', image_embedding_local_port: 8000 },
                { model: 'ViT-L-14', imageSize: 512 }
            );

            expect(result).toEqual({
                embedding: [0.1, 0.2],
                dims: 768,
                provider: 'local',
                model: 'ViT-L-14',
                size: 512
            });
        });

        it('falls back to embedding length when dims missing', async () => {
            axios.post.mockResolvedValueOnce({
                data: { embedding: [0.1, 0.2, 0.3] }
            });

            const result = await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'localhost', image_embedding_local_port: 8000 },
                { model: 'ViT-L-14', imageSize: 512 }
            );

            expect(result.dims).toBe(3);
        });
    });

    describe('getLocalModels', () => {
        it('maps model data to id/name/dims/image_size', async () => {
            axios.get.mockResolvedValueOnce({
                data: {
                    models: [
                        { id: 'vit-l-14', name: 'ViT-L-14', dims: 768, image_size: 512 },
                        { name: 'ViT-B-16', dims: 512, image_size: 384 }
                    ]
                }
            });

            const models = await imageEmbeddingProvider.getLocalModels({
                image_embedding_local_host: 'localhost',
                image_embedding_local_port: 8000
            });

            expect(models).toEqual([
                { id: 'vit-l-14', name: 'ViT-L-14', dims: 768, image_size: 512 },
                { id: 'ViT-B-16', name: 'ViT-B-16', dims: 512, image_size: 384 }
            ]);
        });

        it('sends X-Api-Key header when _localApiKey is set', async () => {
            imageEmbeddingProvider._localApiKey = 'test-key-123';
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            await imageEmbeddingProvider.getLocalModels({
                image_embedding_local_host: 'localhost',
                image_embedding_local_port: 8000
            });

            const callArgs = axios.get.mock.calls[0];
            expect(callArgs[1].headers['X-Api-Key']).toBe('test-key-123');
            imageEmbeddingProvider._localApiKey = null;
        });

        it('uses configurable timeout from config', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            await imageEmbeddingProvider.getLocalModels({
                image_embedding_local_host: 'localhost',
                image_embedding_local_port: 8000,
                image_embedding_local_timeout_ms: 30000
            });

            const callArgs = axios.get.mock.calls[0];
            expect(callArgs[1].timeout).toBe(30000);
        });

        it('defaults timeout to 15000 when not configured', async () => {
            axios.get.mockResolvedValueOnce({ data: { models: [] } });

            await imageEmbeddingProvider.getLocalModels({
                image_embedding_local_host: 'localhost',
                image_embedding_local_port: 8000
            });

            const callArgs = axios.get.mock.calls[0];
            expect(callArgs[1].timeout).toBe(15000);
        });
    });

    describe('embedLocal — auth & timeout (Gaps 3.1, 3.5)', () => {
        it('sends X-Api-Key header when _localApiKey is set', async () => {
            imageEmbeddingProvider._localApiKey = 'secret-key';
            axios.post.mockResolvedValueOnce({ data: { embedding: [0.1], dims: 1 } });

            await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'h', image_embedding_local_port: 8000 },
                { model: 'm', imageSize: 512 }
            );

            expect(axios.post.mock.calls[0][2].headers['X-Api-Key']).toBe('secret-key');
            imageEmbeddingProvider._localApiKey = null;
        });

        it('does NOT send X-Api-Key when _localApiKey is null', async () => {
            imageEmbeddingProvider._localApiKey = null;
            axios.post.mockResolvedValueOnce({ data: { embedding: [], dims: 0 } });

            await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'h', image_embedding_local_port: 8000 },
                { model: 'm', imageSize: 512 }
            );

            expect(axios.post.mock.calls[0][2].headers['X-Api-Key']).toBeUndefined();
        });

        it('uses configurable timeout from config', async () => {
            axios.post.mockResolvedValueOnce({ data: { embedding: [], dims: 0 } });

            await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'h', image_embedding_local_port: 8000, image_embedding_local_timeout_ms: 25000 },
                { model: 'm', imageSize: 512 }
            );

            expect(axios.post.mock.calls[0][2].timeout).toBe(25000);
        });

        it('defaults timeout to 15000 when not in config', async () => {
            axios.post.mockResolvedValueOnce({ data: { embedding: [], dims: 0 } });

            await imageEmbeddingProvider.embedLocal(
                'https://example.com/img.jpg',
                { image_embedding_local_host: 'h', image_embedding_local_port: 8000 },
                { model: 'm', imageSize: 512 }
            );

            expect(axios.post.mock.calls[0][2].timeout).toBe(15000);
        });
    });

    describe('getConfig — decrypts sidecar key (Gap 3.3)', () => {
        it('decrypts image_embedding_local_api_key and stores as _localApiKey', async () => {
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    image_embedding_provider_mode: 'separate_local',
                    image_embedding_local_api_key: 'enc:abc123',
                    image_embedding_local_timeout_ms: 20000
                }]
            });

            await imageEmbeddingProvider.getConfig();

            expect(imageEmbeddingProvider._localApiKey).toBe('decrypted:enc:abc123');
        });

        it('sets _localApiKey to null when column is null', async () => {
            mockDb.query.mockResolvedValueOnce({
                rows: [{
                    image_embedding_provider_mode: 'separate_local',
                    image_embedding_local_api_key: null
                }]
            });

            await imageEmbeddingProvider.getConfig();

            expect(imageEmbeddingProvider._localApiKey).toBeNull();
        });
    });

    describe('resetConfig — circuit breaker self-heal (Gap 3.19)', () => {
        it('resets circuit breaker when not CLOSED', () => {
            mockCB.state = 'OPEN';
            mockCB.reset.mockClear();

            imageEmbeddingProvider.resetConfig();

            expect(mockCB.reset).toHaveBeenCalledTimes(1);
        });

        it('does NOT reset circuit breaker when already CLOSED', () => {
            mockCB.state = 'CLOSED';
            mockCB.reset.mockClear();

            imageEmbeddingProvider.resetConfig();

            expect(mockCB.reset).not.toHaveBeenCalled();
        });

        it('nulls all config fields', () => {
            imageEmbeddingProvider.config = { some: 'data' };
            imageEmbeddingProvider._localApiKey = 'key';

            imageEmbeddingProvider.resetConfig();

            expect(imageEmbeddingProvider.config).toBeNull();
            expect(imageEmbeddingProvider._localApiKey).toBeNull();
        });
    });

    describe('DEFAULTS.rps (Gap 3.10)', () => {
        it('defaults rps to 0.5 (30 req/min, matching sidecar default)', () => {
            imageEmbeddingProvider.resetConfig();
            const limiter = imageEmbeddingProvider.getLimiter({});
            expect(limiter.minIntervalMs).toBe(2000);
        });
    });

    describe('embedImageFromUrl — Issue #330 auth, circuit, reset (Gaps 3.16, 3.18, 3.19, 3.21, 3.24)', () => {
        function makeConfig(overrides = {}) {
            return {
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: 'localhost',
                image_embedding_local_port: 8000,
                image_embedding_local_model: 'ViT-B-16',
                image_embedding_image_size: 512,
                ...overrides
            };
        }

        function make401Error() {
            const err = new Error('Request failed with status code 401');
            err.response = { status: 401 };
            return err;
        }

        it('401 response does not trigger retry — embedLocal is called exactly once', async () => {
            mockCB.run.mockImplementation(async (fn) => fn());
            imageEmbeddingProvider.config = makeConfig();

            axios.post.mockRejectedValueOnce(make401Error());

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toMatchObject({ response: { status: 401 } });

            expect(axios.post).toHaveBeenCalledTimes(1);
        });

        it('401 response produces an [EMBED_AUTH_FAIL] error log entry', async () => {
            mockCB.run.mockImplementation(async (fn) => fn());
            imageEmbeddingProvider.config = makeConfig();

            axios.post.mockRejectedValueOnce(make401Error());

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toBeDefined();

            expect(mockLogger.error).toHaveBeenCalledWith(
                '[EMBED_AUTH_FAIL] Sidecar rejected request: API key missing or incorrect',
                expect.objectContaining({ statusCode: 401 })
            );
        });

        it('CIRCUIT_OPEN — throws before entering limiter.schedule() so queue stays empty', async () => {
            const circuitErr = new Error('Circuit breaker is OPEN');
            circuitErr.code = 'CIRCUIT_OPEN';
            mockCB.run.mockRejectedValue(circuitErr);
            imageEmbeddingProvider.config = makeConfig();

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });

            expect(axios.post).not.toHaveBeenCalled();
        });

        it('CIRCUIT_OPEN produces a warn log (not error) tagged [EMBED_CIRCUIT_OPEN]', async () => {
            const circuitErr = new Error('Circuit breaker is OPEN');
            circuitErr.code = 'CIRCUIT_OPEN';
            mockCB.run.mockRejectedValue(circuitErr);
            imageEmbeddingProvider.config = makeConfig();

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toBeDefined();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                '[EMBED_CIRCUIT_OPEN] Circuit breaker OPEN — image embedding calls suspended',
                expect.objectContaining({ recoveryTimeout: expect.any(Number) })
            );
            expect(mockLogger.error).not.toHaveBeenCalledWith(
                '[EMBED_CIRCUIT_OPEN]',
                expect.anything()
            );
        });

        it('resetConfig() resets circuit breaker immediately so a corrected key works on the next call', async () => {
            mockCB.state = 'OPEN';
            mockCB.reset.mockClear();

            imageEmbeddingProvider.resetConfig();

            expect(mockCB.reset).toHaveBeenCalledTimes(1);

            mockCB.state = 'CLOSED';
            mockCB.run.mockImplementation(async (fn) => fn());
            imageEmbeddingProvider.config = makeConfig();
            axios.post.mockResolvedValueOnce({ data: { embedding: [0.1], dims: 1 } });

            const result = await imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg');
            expect(result.embedding).toEqual([0.1]);
        });

        it('circuit breaker opens after failureThreshold failures and rejects subsequent calls', async () => {
            imageEmbeddingProvider.config = makeConfig();

            const THRESHOLD = 3;
            let callCount = 0;
            mockCB.run.mockImplementation(async (fn) => {
                callCount++;
                if (callCount > THRESHOLD) {
                    const circuitErr = new Error('Circuit breaker is OPEN');
                    circuitErr.code = 'CIRCUIT_OPEN';
                    throw circuitErr;
                }
                return fn();
            });

            axios.post.mockRejectedValue(make401Error());

            for (let i = 0; i < THRESHOLD; i++) {
                await expect(
                    imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
                ).rejects.toMatchObject({ response: { status: 401 } });
            }

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });

            expect(axios.post).toHaveBeenCalledTimes(THRESHOLD);
        });

        it('[EMBED_FAIL] general error path logs a plain object as data arg — no bare strings (Gap 3.24)', async () => {
            mockCB.run.mockImplementation(async (fn) => fn());
            imageEmbeddingProvider.config = makeConfig();

            const networkErr = new Error('ECONNRESET');
            networkErr.response = undefined;
            axios.post.mockRejectedValue(networkErr);

            await expect(
                imageEmbeddingProvider.embedImageFromUrl('https://example.com/img.jpg')
            ).rejects.toBeDefined();

            const embedFailCall = mockLogger.error.mock.calls.find(
                ([msg]) => msg === '[EMBED_FAIL] Image embedding request failed after retries'
            );
            expect(embedFailCall).toBeDefined();
            const dataArg = embedFailCall[1];
            expect(typeof dataArg).toBe('object');
            expect(dataArg).not.toBeNull();
            expect(Array.isArray(dataArg)).toBe(false);
        });
    });
});
