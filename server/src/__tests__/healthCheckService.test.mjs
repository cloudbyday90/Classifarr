/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import { createDbSingleRowResult, createMockLogger, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
const mockDiscordBot = { sendSystemAlert: jest.fn().mockResolvedValue(undefined) };
const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/radarr.mjs', () => ({ radarrService: {} }));

jest.unstable_mockModule('../services/sonarr.mjs', () => ({ sonarrService: {} }));

jest.unstable_mockModule('../services/ollama.mjs', () => ({ ollamaService: {} }));

jest.unstable_mockModule('../services/tmdb.mjs', () => ({ tmdbService: {} }));

jest.unstable_mockModule('../services/omdb.mjs', () => ({ omdbService: {} }));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockLogger = createMockLogger();
jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => mockLogger,
}));

const db = mockDb;
const discordBot = mockDiscordBot;
const { checkImageEmbeddings, resetHealthState } = await import('../services/healthCheckService.mjs');

function resetStableDatabaseFixture() {
    db.query.mockReset();
    db.query.mockImplementation(sql => {
        const first = db.query.mock.calls.findIndex(([query]) => query === sql);
        return db.query.mock.results[first]?.value;
    });
}

describe('healthCheckService.checkImageEmbeddings', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetHealthState();
        resetStableDatabaseFixture();
        mockHttpGet.mockReset();
        discordBot.sendSystemAlert.mockReset().mockResolvedValue(undefined);
        mockLogger.info.mockReset();
        mockLogger.warn.mockReset();
        mockLogger.error.mockReset();
        mockLogger.debug.mockReset();
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

        const result = await checkImageEmbeddings();

        expect(result.status).toBe('disabled');
        expect(mockHttpGet).not.toHaveBeenCalled();
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

        mockHttpGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await checkImageEmbeddings();

        expect(result.status).toBe('not configured');
    });

    test('returns not configured for saved local config when only cache metadata exists', async () => {
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
                rows: [{ has_image_embeddings: false }]
            });

        mockHttpGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await checkImageEmbeddings();

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

        mockHttpGet.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

        const result = await checkImageEmbeddings();

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

        mockHttpGet
            .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } })
            .mockResolvedValueOnce({ status: 200, data: { ready: false, default_model_loaded: false } });

        const result = await checkImageEmbeddings();

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

        mockHttpGet
            .mockResolvedValueOnce({ status: 200, data: { status: 'ok' } })
            .mockRejectedValueOnce(readyError);

        const result = await checkImageEmbeddings();

        expect(result.status).toBe('connected');
        expect(result.readiness).toBe('unknown');
        expect(result.ready).toBeNull();
    });
});

describe('checkImageEmbeddings — Discord transition alerts (Issue #330)', () => {
    const LOCAL_ROW = {
        rag_image_weight: 0.3,
        image_embedding_provider_mode: 'separate_local',
        image_embedding_local_host: 'image-embedder',
        image_embedding_local_port: 11434,
        image_embedding_cloud_provider: null,
        image_embedding_cloud_api_key: null,
        image_embedding_models_cache_updated_at: '2026-03-15T00:00:00.000Z'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        resetHealthState();
        resetStableDatabaseFixture();
        mockHttpGet.mockReset();
        discordBot.sendSystemAlert.mockReset().mockResolvedValue(undefined);
        mockLogger.info.mockReset();
        mockLogger.warn.mockReset();
        mockLogger.error.mockReset();
        mockLogger.debug.mockReset();
    });

    it('does not alert on first-poll healthy (unknown → connected)', async () => {
        db.query.mockResolvedValueOnce(createDbSingleRowResult(LOCAL_ROW));
        mockHttpGet
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });

        await checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('does not alert on first-poll draft config that has never connected', async () => {
        db.query
            .mockResolvedValueOnce(createDbSingleRowResult(LOCAL_ROW))
            .mockResolvedValueOnce(createDbSingleRowResult({ has_image_embeddings: false }));
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        await checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('alerts on connected → disconnected transition', async () => {
        db.query.mockResolvedValueOnce(createDbSingleRowResult(LOCAL_ROW));
        mockHttpGet
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });
        await checkImageEmbeddings();
        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();

        db.query
            .mockResolvedValueOnce(createDbSingleRowResult(LOCAL_ROW))
            .mockResolvedValueOnce(createDbSingleRowResult({ has_image_embeddings: false }));
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(1);
        expect(discordBot.sendSystemAlert).toHaveBeenCalledWith('imageEmbeddings', 'disconnected', 'connected');
    });

    it('does not re-alert when status is unchanged (disconnected → disconnected)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: true }] });
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await checkImageEmbeddings();
        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(1);

        discordBot.sendSystemAlert.mockClear();

        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: true }] });
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });

    it('fires recovery alert on disconnected → connected', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [LOCAL_ROW] })
            .mockResolvedValueOnce({ rows: [{ has_image_embeddings: true }] });
        mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));
        await checkImageEmbeddings();

        db.query.mockResolvedValueOnce({ rows: [LOCAL_ROW] });
        mockHttpGet
            .mockResolvedValueOnce({ status: 200 })
            .mockResolvedValueOnce({ status: 200, data: { ready: true, default_model_loaded: true } });
        await checkImageEmbeddings();

        expect(discordBot.sendSystemAlert).toHaveBeenCalledTimes(2);
        expect(discordBot.sendSystemAlert).toHaveBeenLastCalledWith('imageEmbeddings', 'connected', 'disconnected');
    });
});

describe('checkImageEmbeddings — unexpected outer error (Gap 3.23)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetHealthState();
        resetStableDatabaseFixture();
        discordBot.sendSystemAlert.mockReset().mockResolvedValue(undefined);
        mockLogger.info.mockReset();
        mockLogger.warn.mockReset();
        mockLogger.error.mockReset();
        mockLogger.debug.mockReset();
    });

    it('produces a safe configuration diagnostic when db.query throws', async () => {
        db.query.mockRejectedValueOnce(new Error('DB connection pool exhausted'));

        const result = await checkImageEmbeddings();

        expect(result.status).toBe('unknown');
        expect(mockLogger.warn).toHaveBeenCalledWith(
            'Health observation could not be completed',
            expect.objectContaining({ service: 'imageEmbeddings', code: 'configuration_read_failed' }),
            { skipDbPersist: true }
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(JSON.stringify(result)).not.toContain('DB connection pool exhausted');
    });

    it('logs structured safe context rather than a raw exception', async () => {
        db.query.mockRejectedValueOnce(new Error('unexpected db failure'));

        await checkImageEmbeddings();

        const [, dataArg] = mockLogger.warn.mock.calls.find(
            ([msg]) => msg === 'Health observation could not be completed'
        ) || [];
        expect(typeof dataArg).toBe('object');
        expect(dataArg).not.toBeNull();
        expect(Array.isArray(dataArg)).toBe(false);
        expect(JSON.stringify(dataArg)).not.toContain('unexpected db failure');
    });

    it('does not send a recovery or failure alert when a prior fault cannot be rechecked', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ image_embedding_provider_mode: 'separate_local',
            image_embedding_local_host: 'fixture', rag_image_weight: 1 }] });
        mockHttpGet.mockRejectedValueOnce(new Error('provider unavailable'));
        db.query.mockResolvedValueOnce({ rows: [{ has_image_embeddings: true }] });
        expect((await checkImageEmbeddings()).status).toBe('disconnected');
        discordBot.sendSystemAlert.mockClear();
        db.query.mockRejectedValueOnce(new Error('database unavailable'));
        expect((await checkImageEmbeddings()).status).toBe('unknown');
        expect(discordBot.sendSystemAlert).not.toHaveBeenCalled();
    });
});
