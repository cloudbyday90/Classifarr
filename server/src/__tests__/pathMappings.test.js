/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Path Translation Service Tests
 */

// Mock the database module
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

const db = require('../config/database');
describe('Path Translation Service', () => {
    // Test the translatePath function in fileOperationsService
    const fileOperationsService = require('../services/fileOperationsService');

    beforeEach(() => {
        // Clear the cache before each test
        fileOperationsService.clearPathMappingsCache();
        jest.clearAllMocks();
    });

    test('should translate path when mapping exists', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }
            ]
        });

        const result = await fileOperationsService.translatePath('/movies/Title (2024)');

        expect(result).toBe('/data/movies/Title (2024)');
    });

    test('should return original path when no mapping matches', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }
            ]
        });

        const result = await fileOperationsService.translatePath('/anime/Show (2024)');

        expect(result).toBe('/anime/Show (2024)');
    });

    test('should match longest path first', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/media/movies/4k', local_path: '/data/4k', is_active: true },
                { id: 2, arr_path: '/media/movies', local_path: '/data/movies', is_active: true },
                { id: 3, arr_path: '/media', local_path: '/data', is_active: true }
            ]
        });

        // Should match longest path first (/media/movies/4k)
        const result = await fileOperationsService.translatePath('/media/movies/4k/Title (2024)');

        expect(result).toBe('/data/4k/Title (2024)');
    });

    test('should use cache on subsequent calls', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        // First call - should query DB
        await fileOperationsService.translatePath('/movies/Title1');
        // Second call - should use cache
        await fileOperationsService.translatePath('/movies/Title2');

        // DB should only be called once due to caching
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('Database connection lost'));

        const result = await fileOperationsService.translatePath('/movies/Title (2024)');

        // Should return original path when DB fails
        expect(result).toBe('/movies/Title (2024)');
    });

    test('should clear cache correctly', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        // First call
        await fileOperationsService.translatePath('/movies/Title1');
        expect(db.query).toHaveBeenCalledTimes(1);

        // Clear cache
        fileOperationsService.clearPathMappingsCache();

        // Next call should query DB again
        await fileOperationsService.translatePath('/movies/Title2');
        expect(db.query).toHaveBeenCalledTimes(2);
    });
});
