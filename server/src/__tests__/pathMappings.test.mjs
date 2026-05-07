import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const db = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

const { fileOperationsService } = await import('../services/fileOperationsService.mjs');

describe('Path Translation Service', () => {
    beforeEach(() => {
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

        const result = await fileOperationsService.translatePath('/media/movies/4k/Title (2024)');

        expect(result).toBe('/data/4k/Title (2024)');
    });

    test('should use cache on subsequent calls', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        await fileOperationsService.translatePath('/movies/Title1');
        await fileOperationsService.translatePath('/movies/Title2');

        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('Database connection lost'));

        const result = await fileOperationsService.translatePath('/movies/Title (2024)');

        expect(result).toBe('/movies/Title (2024)');
    });

    test('should clear cache correctly', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        await fileOperationsService.translatePath('/movies/Title1');
        expect(db.query).toHaveBeenCalledTimes(1);

        fileOperationsService.clearPathMappingsCache();

        await fileOperationsService.translatePath('/movies/Title2');
        expect(db.query).toHaveBeenCalledTimes(2);
    });
});
