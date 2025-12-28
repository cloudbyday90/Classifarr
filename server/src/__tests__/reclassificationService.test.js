/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Reclassification Service Tests
 */

const reclassificationService = require('../services/reclassificationService');
const fileOperationsService = require('../services/fileOperationsService');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const libraryMappingService = require('../services/libraryMappingService');
const plexService = require('../services/plex');
const db = require('../config/database');

// Mock dependencies
jest.mock('../services/fileOperationsService');
jest.mock('../services/radarr');
jest.mock('../services/sonarr');
jest.mock('../services/libraryMappingService');
jest.mock('../services/plex');
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Mock logger
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

describe('Reclassification Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
