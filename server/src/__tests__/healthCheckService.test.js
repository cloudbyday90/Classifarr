/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

jest.mock('../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/omdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('axios', () => ({
    get: jest.fn()
}));

describe('healthCheckService.checkImageEmbeddings', () => {
    let db;
    let axios;
    let healthCheckService;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        db = require('../config/database');
        axios = require('axios');
        healthCheckService = require('../services/healthCheckService');
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
});
