/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn() };
const mockDiscordBot = { sendSystemAlert: jest.fn().mockResolvedValue(undefined) };
const mockAxios = { get: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/omdb.mjs', () => ({ default: {} }));

jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.mock('axios', () => mockAxios);
jest.unstable_mockModule('axios', () => ({ ...mockAxios, default: mockAxios }));

describe('healthCheckService.checkImageEmbeddings', () => {
    let db;
    let axios;
    let healthCheckService;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();
        db = mockDb;
        axios = mockAxios;
        const { default: hcs } = await import('../services/healthCheckService.mjs');
        healthCheckService = hcs;
    });

    test('returns disabled when image embeddings are not enabled', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                rag_image_weight: 0,
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: 'image-embedder',
                image_embedding_local_port: 11434,
                image_embedding_cloud_provider: null,
                image_embedding_cloud_api_key: null,
                image_embedding_models_cache_updated_at: null
            }]
        });

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('disabled');
        expect(axios.get).not.toHaveBeenCalled();
    });

    test('returns not configured for draft local config with no validated usage', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{
                    rag_image_weight: 0.3,
                    image_embedding_provider_mode: 'separate_local',
                    image_embedding_local_host: 'image-embedder',
                    image_embedding_local_port: 11434,
                    image_embedding_cloud_provider: null,
                    image_embedding_cloud_api_key: null,
                    image_embedding_models_cache_updated_at: null
                }]
            })
            .mockResolvedValueOnce({
                rows: [{ has_image_embeddings: false }]
            });

        axios.get.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('not configured');
    });

    test('returns disconnected for previously used local image embeddings', async () => {
        db.query
            .mockResolvedValueOnce({
                rows: [{
                    rag_image_weight: 0.3,
                    image_embedding_provider_mode: 'separate_local',
                    image_embedding_local_host: 'image-embedder',
                    image_embedding_local_port: 11434,
                    image_embedding_cloud_provider: null,
                    image_embedding_cloud_api_key: null,
                    image_embedding_models_cache_updated_at: '2026-03-15T00:00:00.000Z'
                }]
            })
            .mockResolvedValueOnce({
                rows: [{ has_image_embeddings: true }]
            });

        axios.get.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('disconnected');
    });

    test('returns degraded when local image embeddings are reachable but not ready', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                rag_image_weight: 0.3,
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: 'image-embedder',
                image_embedding_local_port: 11434,
                image_embedding_cloud_provider: null,
                image_embedding_cloud_api_key: null,
                image_embedding_models_cache_updated_at: '2026-03-15T00:00:00.000Z'
            }]
        });

        axios.get
            .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } })
            .mockResolvedValueOnce({ status: 200, data: { ready: false, default_model_loaded: false } });

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('degraded');
        expect(result.readiness).toBe('warming_up');
        expect(result.ready).toBe(false);
    });

    test('stays connected when local health is good and /ready is unavailable', async () => {
        db.query.mockResolvedValueOnce({
            rows: [{
                rag_image_weight: 0.3,
                image_embedding_provider_mode: 'separate_local',
                image_embedding_local_host: 'image-embedder',
                image_embedding_local_port: 11434,
                image_embedding_cloud_provider: null,
                image_embedding_cloud_api_key: null,
                image_embedding_models_cache_updated_at: '2026-03-15T00:00:00.000Z'
            }]
        });

        const readyError = new Error('Not found');
        readyError.response = { status: 404 };

        axios.get
            .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } })
            .mockRejectedValueOnce(readyError);

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('connected');
        expect(result.readiness).toBe('unknown');
        expect(result.ready).toBeNull();
    });
});

describe('checkImageEmbeddings — Discord transition alerts (Issue #330)', () => {
    let db;
    let axios;
    let discordBot;
    let healthCheckService;

    const LOCAL_ROW = {
        rag_image_weight: 0.3,
        image_embedding_provider_mode: 'separate_local',
        image_embedding_local_host: 'image-embedder',
        image_embedding_local_port: 11434,
        image_embedding_cloud_provider: null,
        image_embedding_cloud_api_key: null,
        image_embedding_models_cache_updated_at: '2026-03-15T00:00:00.000Z'
    };

    let mockLogger;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        jest.unstable_mockModule('../utils/logger.mjs', () => ({
            createLogger: () => mockLogger,
            default: { createLogger: () => mockLogger }
        }));
        db = mockDb;
        axios = mockAxios;
        discordBot = mockDiscordBot;
        const { default: hcs } = await import('../services/healthCheckService.mjs');
        healthCheckService = hcs;
    });

    it('does not alert on first-poll healthy (unknown → connected)', async () => {
        db.query.mockResolvedValueOnce({ rows: [LOCAL_ROW] });
        axios.get
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });

        await healthCheckService.checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('alerts on first-poll unhealthy (unknown → disconnected)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: false }] });
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        await healthCheckService.checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(1);
        expect(discordBot.sendSystemAlert).toHaveBeenCalledWith('imageEmbeddings', 'disconnected', null);
    });

    it('alerts on connected → disconnected transition', async () => {
        db.query.mockResolvedValueOnce({ rows: [LOCAL_ROW] });
        axios.get
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });
        await healthCheckService.checkImageEmbeddings();
        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();

        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: false }] });
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await healthCheckService.checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(1);
        expect(discordBot.sendSystemAlert).toHaveBeenCalledWith('imageEmbeddings', 'disconnected', 'connected');
    });

    it('does not re-alert when status is unchanged (disconnected → disconnected)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: false }] });
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await healthCheckService.checkImageEmbeddings();
        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(1);

        discordBot.sendSystemAlert.mockClear();

        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: false }] });
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await healthCheckService.checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('fires recovery alert on disconnected → connected', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: false }] });
        axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await healthCheckService.checkImageEmbeddings();

        db.query.mockResolvedValueOnce({ rows: [LOCAL_ROW] });
        axios.get
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });
        await healthCheckService.checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(2);
        expect(discordBot.sendSystemAlert).toHaveBeenLastCalledWith('imageEmbeddings', 'connected', 'disconnected');
    });
});

describe('checkImageEmbeddings — unexpected outer error (Gap 3.23)', () => {
    let db;
    let healthCheckService;
    let mockLogger;

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        db = mockDb;
        jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));
        jest.unstable_mockModule('../utils/logger.mjs', () => ({
            createLogger: () => mockLogger,
            default: { createLogger: () => mockLogger }
        }));
        const { default: hcs } = await import('../services/healthCheckService.mjs');
        healthCheckService = hcs;
    });

    it('produces a [HEALTH] error log when db.query throws unexpectedly (Gap 3.23)', async () => {
        db.query.mockRejectedValueOnce(new Error('DB connection pool exhausted'));

        const result = await healthCheckService.checkImageEmbeddings();

        expect(result.status).toBe('error');
        expect(mockLogger.error).toHaveBeenCalledWith(
            '[HEALTH] Unexpected error in checkImageEmbeddings',
            expect.objectContaining({ error: 'DB connection pool exhausted' })
        );
    });

    it('data arg to [HEALTH] logger.error is a plain object, not a bare string (Gap 3.24)', async () => {
        db.query.mockRejectedValueOnce(new Error('unexpected db failure'));

        await healthCheckService.checkImageEmbeddings();

        const [, dataArg] = mockLogger.error.mock.calls.find(
            ([msg]) => msg === '[HEALTH] Unexpected error in checkImageEmbeddings'
        ) || [];
        expect(typeof dataArg).toBe('object');
        expect(dataArg).not.toBeNull();
        expect(Array.isArray(dataArg)).toBe(false);
    });
});
