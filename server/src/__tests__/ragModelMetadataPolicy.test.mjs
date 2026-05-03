/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ragModelMetadataPolicy.
 */

import { jest } from '@jest/globals';

let normalizeTextModelMode;
let resolveSelectedTextModelProvider;
let resolveTextModelApiKey;
let resolveTextModelApiEndpoint;
let resolveImageModelsCacheForLookup;
let resolveImageCloudApiKey;

describe('ragModelMetadataPolicy', () => {
    beforeAll(async () => {
        ({
            normalizeTextModelMode,
            resolveSelectedTextModelProvider,
            resolveTextModelApiKey,
            resolveTextModelApiEndpoint,
            resolveImageModelsCacheForLookup,
            resolveImageCloudApiKey
        } = await import('../routes/helpers/ragModelMetadataPolicy.mjs'));
    });

    test('normalizeTextModelMode falls back to same for unsupported modes', () => {
        expect(normalizeTextModelMode('same')).toBe('same');
        expect(normalizeTextModelMode('cloud')).toBe('cloud');
        expect(normalizeTextModelMode('strange')).toBe('same');
    });

    test('resolveSelectedTextModelProvider prefers explicit provider, then mode-specific config', () => {
        const embeddingProvider = {
            getSameModeProvider: jest.fn(() => ({ provider: 'openai' }))
        };

        expect(resolveSelectedTextModelProvider({
            mode: 'same',
            provider: ' OpenRouter ',
            config: {},
            embeddingProvider
        })).toBe('openrouter');

        expect(resolveSelectedTextModelProvider({
            mode: 'cloud',
            provider: '',
            config: { embedding_cloud_provider: 'voyage' },
            embeddingProvider
        })).toBe('voyage');

        expect(resolveSelectedTextModelProvider({
            mode: 'same',
            provider: '',
            config: { embedding_provider_mode: 'same' },
            embeddingProvider
        })).toBe('openai');
    });

    test('resolveTextModelApiKey and endpoint honor unmasked overrides and stored config fallbacks', () => {
        const isMaskedToken = jest.fn((value) => value === '********');

        expect(resolveTextModelApiKey({
            mode: 'cloud',
            provider: 'openai',
            apiKey: 'request-key',
            config: { embedding_cloud_api_key: 'stored-cloud' },
            isMaskedToken
        })).toBe('request-key');

        expect(resolveTextModelApiKey({
            mode: 'cloud',
            provider: 'openai',
            apiKey: '********',
            config: { embedding_cloud_api_key: 'stored-cloud' },
            isMaskedToken
        })).toBe('stored-cloud');

        expect(resolveTextModelApiEndpoint({
            mode: 'same',
            apiEndpoint: '',
            config: { api_endpoint: 'https://stored-endpoint.test' }
        })).toBe('https://stored-endpoint.test');
    });

    test('resolveImageModelsCacheForLookup matches only the exact cache key for cloud and local modes', () => {
        const config = {
            image_embedding_models_cache: {
                cloud: {
                    provider: 'openai',
                    api_endpoint: 'https://api.openai.test',
                    models: [{ id: 'clip-large' }]
                },
                local: {
                    host: '127.0.0.1',
                    port: 8080,
                    models: [{ id: 'jina-clip-v2' }]
                }
            }
        };

        expect(resolveImageModelsCacheForLookup({
            config,
            mode: 'cloud',
            cloudProvider: 'openai',
            cloudApiEndpoint: 'https://api.openai.test'
        })).toEqual({
            scope: 'cloud',
            entry: config.image_embedding_models_cache.cloud
        });

        expect(resolveImageModelsCacheForLookup({
            config,
            mode: 'separate_local',
            localHost: '127.0.0.1',
            localPort: 8080
        })).toEqual({
            scope: 'local',
            entry: config.image_embedding_models_cache.local
        });

        expect(resolveImageModelsCacheForLookup({
            config,
            mode: 'cloud',
            cloudProvider: 'openai',
            cloudApiEndpoint: 'https://different.test'
        })).toBeNull();
    });

    test('resolveImageCloudApiKey falls back to stored config when request key is masked', () => {
        const isMaskedToken = jest.fn((value) => value === '********');

        expect(resolveImageCloudApiKey({
            apiKey: 'request-key',
            config: { image_embedding_cloud_api_key: 'stored-key' },
            isMaskedToken
        })).toBe('request-key');

        expect(resolveImageCloudApiKey({
            apiKey: '********',
            config: { image_embedding_cloud_api_key: 'stored-key' },
            isMaskedToken
        })).toBe('stored-key');
    });
});
