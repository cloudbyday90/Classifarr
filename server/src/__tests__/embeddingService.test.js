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
const db = require('../config/database');

jest.mock('../services/embeddingRouter');
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
    });

    describe('generateAndStore', () => {
        it('should generate embedding via router', async () => {
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

        it('should handle errors gracefully', async () => {
            // It catches errors and returns null
            const result = await embeddingService.generateAndStore(1, null);
            expect(result).toBeNull();
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
});
