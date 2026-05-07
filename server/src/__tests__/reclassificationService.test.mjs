/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Reclassification Service Tests
 */

import { jest } from '@jest/globals';
import { createConsoleSpy } from './setup/consoleHelpers.mjs';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockFileOperationsService = {
    translatePath: jest.fn(),
    moveFolder: jest.fn()
};

const mockRadarrService = {
    getMovieByTmdbId: jest.fn(),
    validatePathInRootFolder: jest.fn(),
    updateMoviePath: jest.fn()
};

const mockSonarrService = {
    getSeriesByTvdbId: jest.fn(),
    validatePathInRootFolder: jest.fn(),
    updateSeriesPath: jest.fn()
};

const mockLibraryMappingService = {
    getLibraryMapping: jest.fn()
};

const mockDb = { query: jest.fn() };

const mockLogger = {
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
};

await jest.unstable_mockModule('../services/fileOperationsService.mjs', () => createMockModule(mockFileOperationsService));
await jest.unstable_mockModule('../services/radarr.mjs', () => createMockModule(mockRadarrService));
await jest.unstable_mockModule('../services/sonarr.mjs', () => createMockModule(mockSonarrService));
await jest.unstable_mockModule('../services/libraryMappingService.mjs', () => createMockModule(mockLibraryMappingService));
await jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));
await jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const fileOperationsService = mockFileOperationsService;
const radarrService = mockRadarrService;
const sonarrService = mockSonarrService;
const libraryMappingService = mockLibraryMappingService;
const db = mockDb;

describe('Reclassification Service', () => {
    let consoleErrorSpy;
    let reclassificationService;
    let triggerPlexScanSpy;

    beforeAll(async () => {
        consoleErrorSpy = createConsoleSpy('error', { suppress: true });
        ({ default: reclassificationService } = await import('../services/reclassificationService.mjs'));
    });

    afterAll(() => {
        consoleErrorSpy.restore();
    });

    beforeEach(() => {
        jest.resetAllMocks();
        triggerPlexScanSpy = jest.spyOn(reclassificationService, 'triggerPlexScan').mockResolvedValue({ success: true, scans: [] });
    });

    afterEach(() => {
        triggerPlexScanSpy.mockRestore();
    });

    describe('executeReclassification', () => {
        const mockClassification = {
            id: 1,
            tmdb_id: 12345,
            tvdb_id: null,
            media_type: 'movie',
            library_id: 10,
            title: 'Test Movie'
        };

        const mockTargetMapping = {
            id: 2,
            library_id: 20,
            arr_config_id: 1,
            arr_root_folder_path: '/media/movies/new',
            arr_type: 'radarr'
        };

        const mockOriginalMapping = {
            id: 1,
            library_id: 10,
            arr_config_id: 1,
            arr_root_folder_path: '/media/movies/old',
            arr_type: 'radarr'
        };

        const mockContext = {
            classificationId: 1,
            targetLibraryId: 20,
            correctedBy: 'user'
        };

        test('should successfully reclassify a movie', async () => {
            // Mock DB response for classification
            db.query.mockResolvedValueOnce({ rows: [mockClassification] });

            // Mock library mapping
            libraryMappingService.getLibraryMapping
                .mockResolvedValueOnce(mockTargetMapping)
                .mockResolvedValueOnce(mockOriginalMapping);

            // Mock Radarr config fetch
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://radarr:7878', api_key: 'abc' }] });

            // Mock Radarr movie lookup
            radarrService.getMovieByTmdbId.mockResolvedValue({
                id: 100,
                path: '/media/movies/old/Test Movie (2024)'
            });

            // Mock path validation
            radarrService.validatePathInRootFolder.mockResolvedValue({ isValid: true, matchedRootFolder: '/media/movies/new' });

            // Mock path translation
            fileOperationsService.translatePath
                .mockResolvedValueOnce('/data/movies/old/Test Movie (2024)') // current
                .mockResolvedValueOnce('/data/movies/new/Test Movie (2024)'); // new

            // Mock file move
            fileOperationsService.moveFolder.mockResolvedValue({ success: true, fileCount: 5, duration: 100 });

            // Mock Radarr update
            radarrService.updateMoviePath.mockResolvedValue({ id: 100, path: '/media/movies/new/Test Movie (2024)' });

            const result = await reclassificationService.executeReclassification(mockContext);

            expect(result.success).toBe(true);
            expect(result.message).toContain('Successfully moved');
            expect(fileOperationsService.translatePath).toHaveBeenCalledTimes(2);
            expect(fileOperationsService.moveFolder).toHaveBeenCalledWith(
                '/data/movies/old/Test Movie (2024)',
                '/data/movies/new/Test Movie (2024)',
                expect.any(Object)
            );
            expect(radarrService.updateMoviePath).toHaveBeenCalled();
            expect(triggerPlexScanSpy).toHaveBeenCalledWith(expect.objectContaining({
                newPath: '/media/movies/new/Test Movie (2024)',
                oldPath: '/media/movies/old/Test Movie (2024)'
            }));
        });

        test('should fail if media type mismatch', async () => {
            db.query.mockResolvedValueOnce({ rows: [mockClassification] });

            // Target shows as Sonarr but Media Type is Movie
            libraryMappingService.getLibraryMapping.mockResolvedValueOnce({ ...mockTargetMapping, arr_type: 'sonarr' });

            const result = await reclassificationService.executeReclassification(mockContext);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Media type mismatch');
        });

        test('should fail if file move fails', async () => {
            // Setup similar to success flow
            db.query.mockResolvedValueOnce({ rows: [mockClassification] });
            libraryMappingService.getLibraryMapping.mockResolvedValueOnce(mockTargetMapping);
            libraryMappingService.getLibraryMapping.mockResolvedValueOnce(mockOriginalMapping);
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://radarr:7878', api_key: 'abc' }] });
            radarrService.getMovieByTmdbId.mockResolvedValue({ id: 100, path: '/old/path' });
            radarrService.validatePathInRootFolder.mockResolvedValue({ isValid: true });

            fileOperationsService.translatePath.mockImplementation(p => p);

            // Mock file move FAILURE
            fileOperationsService.moveFolder.mockResolvedValue({ success: false, error: 'Permission denied' });

            const result = await reclassificationService.executeReclassification(mockContext);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Permission denied');
        });
    });

    describe('translatePath Integration', () => {
        test('should use translatePath in moveSeries', async () => {
            const context = {
                tvdbId: 555,
                targetMapping: { arr_config_id: 1, arr_root_folder_path: '/tv/new', arr_type: 'sonarr' },
                originalMapping: {},
                title: 'Test Show'
            };

            db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://sonarr:8989', api_key: 'xyz' }] });
            sonarrService.getSeriesByTvdbId.mockResolvedValue({ id: 200, path: '/tv/old/Test Show' });
            sonarrService.validatePathInRootFolder.mockResolvedValue({ isValid: true });

            fileOperationsService.moveFolder.mockResolvedValue({ success: true });
            sonarrService.updateSeriesPath.mockResolvedValue({});

            await reclassificationService.moveSeries(context);

            expect(fileOperationsService.translatePath).toHaveBeenCalledWith('/tv/old/Test Show');
            expect(fileOperationsService.translatePath).toHaveBeenCalledWith('/tv/old/Test Show'); // Actually called for current and new
            expect(fileOperationsService.translatePath).toHaveBeenCalledTimes(2);
        });
    });
});
