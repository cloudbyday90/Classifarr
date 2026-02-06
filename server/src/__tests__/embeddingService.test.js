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

const embeddingService = require('../services/embeddingService');
const embeddingRouter = require('../services/embeddingRouter');
const imageEmbeddingProvider = require('../services/imageEmbeddingProvider');
const db = require('../config/database');

jest.mock('../services/embeddingRouter');
jest.mock('../services/imageEmbeddingProvider', () => ({
    getConfig: jest.fn(),
    isConfigured: jest.fn(),
    getEffectiveModel: jest.fn(),
    getEffectiveSize: jest.fn(),
    embedImageFromUrl: jest.fn()
}));
jest.mock('../config/database');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('EmbeddingService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        // clearAllMocks is also good for mock fns, but restore handles spies
        jest.clearAllMocks();
        embeddingRouter.isEnabled.mockResolvedValue(true);
        imageEmbeddingProvider.getConfig.mockResolvedValue(null);
        imageEmbeddingProvider.isConfigured.mockReturnValue(false);
    });

    describe('generateAndStore', () => {
        it('should generate embedding via router', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(true);
            embeddingRouter.embed.mockResolvedValue({
                embedding: [0.1, 0.2, 0.3],
                dims: 3,
                provider: 'ollama',
                cost: 0
            });
            // Mock storeEmbedding to return result immediately
            jest.spyOn(embeddingService, 'storeEmbedding').mockResolvedValue({ id: 1 });

            const result = await embeddingService.generateAndStore(1, {
                title: 'Test Title',
                overview: 'Test Overview'
            });

            expect(embeddingRouter.embed).toHaveBeenCalledWith(expect.stringContaining('Test Title'));
            expect(result).toEqual({ id: 1 });
        });

        it('should no-op when RAG is disabled', async () => {
            embeddingRouter.isEnabled.mockResolvedValue(false);

            const storeSpy = jest.spyOn(embeddingService, 'storeEmbedding');
            const retrySpy = jest.spyOn(embeddingService, 'addToRetryQueue');

            const result = await embeddingService.generateAndStore(1, {
                title: 'Test Title',
                overview: 'Test Overview'
            });

            expect(result).toBeNull();
            expect(embeddingRouter.embed).not.toHaveBeenCalled();
            expect(storeSpy).not.toHaveBeenCalled();
            expect(retrySpy).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            // It catches errors and returns null
            const result = await embeddingService.generateAndStore(1, null);
            expect(result).toBeNull();
        });
    });

    describe('resolvePosterUrl', () => {
        it('should return full TMDb URL for poster_path', () => {
            const url = embeddingService.resolvePosterUrl({ poster_path: '/abc.jpg' });
            expect(url).toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
        });

        it('should return posterPath URL directly when already full URL', () => {
            const url = embeddingService.resolvePosterUrl({ posterPath: 'https://example.com/poster.jpg' });
            expect(url).toBe('https://example.com/poster.jpg');
        });

        it('should return null when no poster path', () => {
            const url = embeddingService.resolvePosterUrl({ title: 'No Poster' });
            expect(url).toBeNull();
        });
    });

    describe('resolvePosterUrlForClassification', () => {
        it('should fallback to media server poster cache when metadata is missing', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ poster_path: 'https://example.com/poster.jpg' }]
            });

            const url = await embeddingService.resolvePosterUrlForClassification(42, {});

            expect(url).toBe('https://example.com/poster.jpg');
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM classification_history'),
                [42]
            );
        });
    });

    describe('shouldReuseImageEmbedding', () => {
        it('should return true when hash/model/size match', () => {
            const existing = {
                image_embedding_hash: 'hash',
                image_model: 'model',
                image_embedding_size: 512,
                has_image: true
            };

            const result = embeddingService.shouldReuseImageEmbedding(existing, 'hash', 'model', 512);
            expect(result).toBe(true);
        });

        it('should return false when missing or mismatch', () => {
            const existing = {
                image_embedding_hash: 'hash',
                image_model: 'model',
                image_embedding_size: 512,
                has_image: true
            };

            expect(embeddingService.shouldReuseImageEmbedding(null, 'hash', 'model', 512)).toBe(false);
            expect(embeddingService.shouldReuseImageEmbedding(existing, 'other', 'model', 512)).toBe(false);
            expect(embeddingService.shouldReuseImageEmbedding(existing, 'hash', 'other', 512)).toBe(false);
            expect(embeddingService.shouldReuseImageEmbedding(existing, 'hash', 'model', 256)).toBe(false);
        });
    });

    describe('shouldIncludeImageEmbeddings', () => {
        it('should return false when no config', async () => {
            imageEmbeddingProvider.getConfig.mockResolvedValue(null);
            const result = await embeddingService.shouldIncludeImageEmbeddings();
            expect(result).toBe(false);
        });

        it('should return false when mode is disabled', async () => {
            imageEmbeddingProvider.getConfig.mockResolvedValue({
                rag_image_weight: 0.4,
                image_embedding_provider_mode: 'disabled'
            });
            imageEmbeddingProvider.isConfigured.mockReturnValue(false);
            const result = await embeddingService.shouldIncludeImageEmbeddings();
            expect(result).toBe(false);
        });

        it('should return false when weight is zero', async () => {
            imageEmbeddingProvider.getConfig.mockResolvedValue({ rag_image_weight: 0 });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);
            const result = await embeddingService.shouldIncludeImageEmbeddings();
            expect(result).toBe(false);
        });

        it('should return true when weight > 0 and configured', async () => {
            imageEmbeddingProvider.getConfig.mockResolvedValue({ rag_image_weight: 0.3 });
            imageEmbeddingProvider.isConfigured.mockReturnValue(true);
            const result = await embeddingService.shouldIncludeImageEmbeddings();
            expect(result).toBe(true);
        });
    });

    describe('storeEmbedding', () => {
        it('should insert embedding into database', async () => {
            const vector = [0.1, 0.2, 0.3];
            db.query.mockResolvedValue({ rowCount: 1, rows: [{ id: 100 }] });

            // Pass object as 2nd arg
            const result = await embeddingService.storeEmbedding(123, {
                embedding: vector,
                dims: 3,
                provider: 'ollama',
                model: 'v1'
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO classification_embeddings'),
                expect.arrayContaining([123, expect.any(String), 3, 'ollama', 'v1'])
            );
        });
    });

    describe('formatForEmbedding', () => {
        it('should format metadata with all fields', () => {
            const metadata = {
                title: 'Test Movie',
                year: 2024,
                media_type: 'movie',
                genres: ['Action', 'Drama'],
                keywords: ['hero', 'adventure'],
                overview: 'A great movie about heroes.',
                library_name: 'Movies'
            };

            const result = embeddingService.formatForEmbedding(metadata);

            expect(result).toContain('Test Movie');
            expect(result).toContain('2024');
            expect(result).toContain('movie');
            expect(result).toContain('Action');
            expect(result).toContain('hero');
        });

        it('should handle missing fields gracefully', () => {
            const metadata = { title: 'Minimal' };

            const result = embeddingService.formatForEmbedding(metadata);

            expect(result).toContain('Minimal');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('markStale', () => {
        it('should mark all embeddings as stale', async () => {
            db.query.mockResolvedValue({ rowCount: 10 });

            const count = await embeddingService.markStale();

            expect(count).toBe(10);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE classification_embeddings SET is_stale = true'),
                []
            );
        });

        it('should mark specific provider embeddings as stale', async () => {
            db.query.mockResolvedValue({ rowCount: 5 });

            const count = await embeddingService.markStale('ollama', 'nomic-embed-text');

            expect(count).toBe(5);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE provider = $1'),
                ['ollama', 'nomic-embed-text']
            );
        });
    });

    describe('getStats', () => {
        it('should return embedding statistics with field aliases', async () => {
            db.query
                .mockResolvedValueOnce({
                    rows: [{ total: '100', stale: '5', providers: '2', avg_dims: '768.5' }]
                })
                .mockResolvedValueOnce({
                    rows: [{ pending: '3' }]  // retry queue count
                })
                .mockResolvedValueOnce({
                    rows: [{ count: '42' }]  // actual pending embeddings (items without embeddings)
                });

            const stats = await embeddingService.getStats();

            expect(stats).toEqual({
                total: 100,
                totalEmbeddings: 100,  // Alias field
                stale: 5,
                providers: 2,
                avgDims: 769,
                pendingRetries: 3,
                pendingCount: 42  // Now counts actual items without embeddings, not retry queue
            });
        });
    });

    describe('getImageStats', () => {
        it('should return image embedding stats', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ total: '12', pending: '7' }]
            });

            const stats = await embeddingService.getImageStats();

            expect(stats).toEqual({ total: 12, pending: 7 });
        });
    });

    describe('getPendingCount', () => {
        it('should query pending without image when includeImage is false', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

            const count = await embeddingService.getPendingCount({ includeImage: false });

            expect(count).toBe(5);
            expect(db.query.mock.calls[0][0]).not.toContain('image_embedding IS NULL');
        });

        it('should include image pending when includeImage is true', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ count: '9' }] });

            const count = await embeddingService.getPendingCount({ includeImage: true });

            expect(count).toBe(9);
            expect(db.query.mock.calls[0][0]).toContain('image_embedding IS NULL');
        });
    });

    describe('getPendingEmbeddings', () => {
        it('should map needsText/needsImage flags', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    {
                        id: 1,
                        title: 'Movie',
                        media_type: 'movie',
                        library_name: 'Movies',
                        metadata: '{"poster_path":"/abc.jpg"}',
                        needs_text: true,
                        needs_image: false
                    },
                    {
                        id: 2,
                        title: 'Show',
                        media_type: 'tv',
                        library_name: 'TV',
                        metadata: { poster_path: '/def.jpg' },
                        needs_text: false,
                        needs_image: true
                    }
                ]
            });

            const rows = await embeddingService.getPendingEmbeddings({ limit: 2, includeImage: true });

            expect(rows).toHaveLength(2);
            expect(rows[0].needsText).toBe(true);
            expect(rows[0].needsImage).toBe(false);
            expect(rows[1].needsText).toBe(false);
            expect(rows[1].needsImage).toBe(true);
        });
    });

    describe('getPendingBreakdown', () => {
        it('should return pending text/image totals', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ pending_text: '4', pending_image: '6' }]
            });

            const breakdown = await embeddingService.getPendingBreakdown();

            expect(breakdown).toEqual({ text: 4, image: 6, total: 10 });
        });
    });

    describe('hasMinimumEmbeddings', () => {
        it('should return true when above threshold', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ rag_min_history_count: 50 });
            db.query.mockResolvedValue({ rows: [{ count: '100' }] });

            const result = await embeddingService.hasMinimumEmbeddings();

            expect(result).toBe(true);
        });

        it('should return false when below threshold', async () => {
            embeddingRouter.getConfig.mockResolvedValue({ rag_min_history_count: 50 });
            db.query.mockResolvedValue({ rows: [{ count: '25' }] });

            const result = await embeddingService.hasMinimumEmbeddings();

            expect(result).toBe(false);
        });
    });

    describe('storeImageEmbedding', () => {
        it('auto-heals image vector schema on dimension mismatch', async () => {
            let callCount = 0;
            db.query.mockImplementation(async (sql) => {
                callCount += 1;
                if (callCount === 1) {
                    throw new Error('expected 2000 dimensions, not 768');
                }
                return { rows: [] };
            });

            const result = await embeddingService.storeImageEmbedding(
                101,
                { embedding: [0.1, 0.2], dims: 768, provider: 'local', model: 'ViT-L-14' },
                { imageHash: 'hash', imageSize: 512, posterUrl: 'https://example.com/a.jpg' }
            );

            expect(result).toEqual({ classificationId: 101, dims: 768, provider: 'local' });
            const executedSql = db.query.mock.calls.map(([sql]) => sql).join('\n');
            expect(executedSql).toContain('DROP COLUMN image_embedding');
            expect(executedSql).toContain('vector(768)');
        });
    });
});
