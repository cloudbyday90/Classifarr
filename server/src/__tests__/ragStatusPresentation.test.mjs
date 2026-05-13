/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for ragStatusPresentation.
 */

import { jest } from '@jest/globals';
import {
    buildImageStatusPayload,
    normalizeImageProviderMode,
    resolveImageProvider,
    resolveImageStatus,
    resolveProviderOnline
} from '../routes/helpers/ragStatusPresentation.mjs';

describe('ragStatusPresentation', () => {
    test('normalizeImageProviderMode folds legacy local mode into separate_local', () => {
        expect(normalizeImageProviderMode('local')).toBe('separate_local');
        expect(normalizeImageProviderMode('cloud')).toBe('cloud');
        expect(normalizeImageProviderMode('weird-mode')).toBe('disabled');
    });

    test('resolveImageStatus reports configured only after embeddings exist', () => {
        expect(resolveImageStatus({
            enabled: true,
            mode: 'cloud',
            providerConfigured: true,
            stats: { total: 0 },
            config: { image_embedding_models_cache_updated_at: '2026-04-01T00:00:00.000Z' }
        })).toBe('not_configured');

        expect(resolveImageStatus({
            enabled: true,
            mode: 'cloud',
            providerConfigured: true,
            stats: { total: 5 },
            config: {}
        })).toBe('configured');

        expect(resolveImageStatus({
            enabled: true,
            mode: 'cloud',
            providerConfigured: false,
            stats: { total: 5 },
            config: {}
        })).toBe('not_configured');
    });

    test('resolveProviderOnline requires configured provider, closed circuit, and available embedding status', () => {
        expect(resolveProviderOnline({
            providerConfigured: true,
            circuitStatus: { state: 'CLOSED' },
            embeddingAvailability: { status: 'available' }
        })).toBe(true);

        expect(resolveProviderOnline({
            providerConfigured: true,
            circuitStatus: { state: 'OPEN' },
            embeddingAvailability: { status: 'available' }
        })).toBe(false);
    });

    test('buildImageStatusPayload assembles disabled and local payload variants consistently', () => {
        const imageEmbeddingProvider = {
            getEffectiveModel: jest.fn((config) => config.image_embedding_model || null)
        };

        const disabledPayload = buildImageStatusPayload({
            config: { rag_image_weight: 0 },
            imageConfig: { image_embedding_provider_mode: 'disabled' },
            imageStats: { total: 0 },
            imageProviderConfigured: false,
            imageProvider: null,
            imageEmbeddingProvider
        });
        expect(disabledPayload).toEqual({
            enabled: false,
            providerOnline: false,
            providerConfigured: false,
            status: 'disabled',
            providerMode: 'disabled',
            provider: 'disabled',
            model: null,
            stats: { total: 0 }
        });

        const localPayload = buildImageStatusPayload({
            config: { rag_image_weight: 0.5 },
            imageConfig: {
                image_embedding_provider_mode: 'local',
                image_embedding_local_host: '127.0.0.1',
                image_embedding_model: 'jina-clip-v2'
            },
            imageStats: { total: 3 },
            imageProviderConfigured: true,
            imageProvider: null,
            imageEmbeddingProvider
        });
        expect(localPayload).toEqual({
            enabled: true,
            providerOnline: true,
            providerConfigured: true,
            status: 'configured',
            providerMode: 'separate_local',
            provider: 'local',
            model: 'jina-clip-v2',
            stats: { total: 3 }
        });
    });

    test('resolveImageProvider keeps provider naming stable across modes', () => {
        expect(resolveImageProvider({ mode: 'disabled', config: {} })).toBe('disabled');
        expect(resolveImageProvider({ mode: 'cloud', config: { image_embedding_cloud_provider: 'openai' } })).toBe('openai');
        expect(resolveImageProvider({ mode: 'separate_local', config: {} })).toBe('local');
    });
});
