/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Library Mapping Service Tests - Auto-Detect Exact Match
 */

import { jest } from '@jest/globals';

const mockDb = { query: jest.fn(), pool: { connect: jest.fn() } };

jest.unstable_mockModule('../config/database.mjs', () => ({
    ...mockDb,
    default: mockDb,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: jest.fn(() => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn()
    }))
}));

const mockRadarr = { getSystemStatus: jest.fn(), getRootFolders: jest.fn() };
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

const mockSonarr = { getSystemStatus: jest.fn(), getRootFolders: jest.fn() };
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

await import('../config/database.mjs');
const { default: libraryMappingService } = await import('../services/libraryMappingService.mjs');
const db = mockDb;

describe('LibraryMappingService - Auto-Detect Exact Match', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('autoDetectMappings', () => {
        beforeEach(() => {
            jest.spyOn(libraryMappingService, 'getUnmappedLibraries');
            jest.spyOn(libraryMappingService, 'getAvailableArrInstances');
            jest.spyOn(libraryMappingService, 'getArrRootFolders');
            jest.spyOn(libraryMappingService, 'saveMapping');
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should match library when folder name EXACTLY equals library name', async () => {
            libraryMappingService.getUnmappedLibraries.mockResolvedValue([
                { id: 1, name: 'Family', media_type: 'movie' }
            ]);
            libraryMappingService.getAvailableArrInstances.mockResolvedValue({
                radarr: [{ id: 1, name: 'Radarr' }],
                sonarr: []
            });
            libraryMappingService.getArrRootFolders.mockResolvedValue([
                { id: 10, path: '/local/movies/Family' }
            ]);
            libraryMappingService.saveMapping.mockResolvedValue({});

            const result = await libraryMappingService.autoDetectMappings(1);

            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].library_name).toBe('Family');
            expect(result.applied[0].arr_root_folder_path).toBe('/local/movies/Family');
            expect(libraryMappingService.saveMapping).toHaveBeenCalled();
        });

        test('should NOT match library when folder name only CONTAINS library name', async () => {
            libraryMappingService.getUnmappedLibraries.mockResolvedValue([
                { id: 1, name: 'Movies', media_type: 'movie' }
            ]);
            libraryMappingService.getAvailableArrInstances.mockResolvedValue({
                radarr: [{ id: 1, name: 'Radarr' }],
                sonarr: []
            });
            libraryMappingService.getArrRootFolders.mockResolvedValue([
                { id: 10, path: '/local/movies/Christmas' },
                { id: 11, path: '/local/movies/Comedy' }
            ]);

            const result = await libraryMappingService.autoDetectMappings(1);

            expect(result.applied).toHaveLength(0);
            expect(result.suggestions).toHaveLength(0);
            expect(libraryMappingService.saveMapping).not.toHaveBeenCalled();
        });

        test('should match case-insensitively', async () => {
            libraryMappingService.getUnmappedLibraries.mockResolvedValue([
                { id: 1, name: 'FAMILY', media_type: 'movie' }
            ]);
            libraryMappingService.getAvailableArrInstances.mockResolvedValue({
                radarr: [{ id: 1, name: 'Radarr' }],
                sonarr: []
            });
            libraryMappingService.getArrRootFolders.mockResolvedValue([
                { id: 10, path: '/local/movies/family' }
            ]);
            libraryMappingService.saveMapping.mockResolvedValue({});

            const result = await libraryMappingService.autoDetectMappings(1);

            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].library_name).toBe('FAMILY');
        });

        test('should match TV library to Sonarr folders only (not Radarr)', async () => {
            libraryMappingService.getUnmappedLibraries.mockResolvedValue([
                { id: 1, name: 'Anime', media_type: 'tv' }
            ]);
            libraryMappingService.getAvailableArrInstances.mockResolvedValue({
                radarr: [{ id: 1, name: 'Radarr' }],
                sonarr: [{ id: 2, name: 'Sonarr' }]
            });
            libraryMappingService.getArrRootFolders.mockImplementation((type, _configId) => {
                if (type === 'radarr') {
                    return Promise.resolve([{ id: 10, path: '/movies/Anime' }]);
                }
                if (type === 'sonarr') {
                    return Promise.resolve([{ id: 20, path: '/tv/Anime' }]);
                }
                return Promise.resolve([]);
            });
            libraryMappingService.saveMapping.mockResolvedValue({});

            const result = await libraryMappingService.autoDetectMappings(1);

            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].arr_type).toBe('sonarr');
            expect(result.applied[0].arr_root_folder_path).toBe('/tv/Anime');
        });

        test('should handle Windows-style paths correctly', async () => {
            libraryMappingService.getUnmappedLibraries.mockResolvedValue([
                { id: 1, name: 'Comedy', media_type: 'movie' }
            ]);
            libraryMappingService.getAvailableArrInstances.mockResolvedValue({
                radarr: [{ id: 1, name: 'Radarr' }],
                sonarr: []
            });
            libraryMappingService.getArrRootFolders.mockResolvedValue([
                { id: 10, path: 'C:\\media\\movies\\Comedy' }
            ]);
            libraryMappingService.saveMapping.mockResolvedValue({});

            const result = await libraryMappingService.autoDetectMappings(1);

            expect(result.applied).toHaveLength(1);
            expect(result.applied[0].arr_root_folder_path).toBe('C:\\media\\movies\\Comedy');
        });
    });

    describe('saveMapping', () => {
        test('should update libraries table when mapping is saved', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ id: 1, library_id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            await libraryMappingService.saveMapping({
                library_id: 1,
                arr_type: 'radarr',
                arr_config_id: 1,
                arr_root_folder_id: 10,
                arr_root_folder_path: '/movies',
                quality_profile_id: 4,
                plex_path_prefix: null,
                arr_path_prefix: null,
                classifarr_path_prefix: null
            });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE libraries'),
                expect.arrayContaining([1, 'radarr', 1, '/movies', 4])
            );
        });

        test('should cast JSON setting placeholders explicitly when syncing libraries table', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ id: 1, library_id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            await libraryMappingService.saveMapping({
                library_id: 1,
                arr_type: 'sonarr',
                arr_config_id: 2,
                arr_root_folder_id: 20,
                arr_root_folder_path: '/tv',
                quality_profile_id: 7,
                plex_path_prefix: null,
                arr_path_prefix: null,
                classifarr_path_prefix: null
            });

            const updateCall = db.query.mock.calls.find(call =>
                typeof call[0] === 'string' && call[0].includes('UPDATE libraries')
            );

            expect(updateCall).toBeDefined();
            expect(updateCall[0]).toContain("'root_folder_path', $4::text");
            expect(updateCall[0]).toContain("'quality_profile_id', $5::integer");
        });
    });
});
