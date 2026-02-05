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

const axios = require('axios');
const imageEmbeddingProvider = require('../services/imageEmbeddingProvider');

jest.mock('axios');
jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('ImageEmbeddingProvider', () => {
    beforeEach(() => {
        jest.resetAllMocks();
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
    });
});
