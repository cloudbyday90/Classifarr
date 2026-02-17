/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for RadarrService
 */

const mockAxios = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    create: jest.fn(() => ({
        get: jest.fn()
    }))
};
jest.mock('axios', () => mockAxios);

describe('RadarrService', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.get.mockReset();
        mockAxios.post.mockReset();
        mockAxios.put.mockReset();
        mockAxios.create.mockReset();
        mockAxios.create.mockReturnValue({
            get: jest.fn().mockResolvedValue({ data: [] })
        });

        jest.resetModules();
        service = require('../services/radarr');
    });

    describe('buildUrl', () => {
        it('should build URL with default values', () => {
            const url = service.buildUrl({});
            expect(url).toBe('http://localhost:7878');
        });

        it('should build URL with custom values', () => {
            const url = service.buildUrl({
                protocol: 'https',
                host: 'radarr.example.com',
                port: 443,
                base_path: '/radarr'
            });
            expect(url).toBe('https://radarr.example.com:443/radarr');
        });

        it('should handle base path without leading slash', () => {
            const url = service.buildUrl({
                host: 'radarr.local',
                base_path: 'radarr'
            });
            expect(url).toBe('http://radarr.local:7878/radarr');
        });

        it('should handle base path with leading slash', () => {
            const url = service.buildUrl({
                host: 'radarr.local',
                base_path: '/radarr'
            });
            expect(url).toBe('http://radarr.local:7878/radarr');
        });
    });

    describe('testConnection', () => {
        it('should return success with connection details', async () => {
            mockAxios.get.mockResolvedValue({ data: { version: '5.0.0' } });
            mockAxios.create.mockReturnValue({
                get: jest.fn()
                    .mockResolvedValueOnce({ data: { version: '5.0.0' } })
                    .mockResolvedValueOnce({ data: [{ id: 1, name: 'HD' }] })
                    .mockResolvedValueOnce({ data: [{ id: 1, path: '/movies' }] })
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 7878,
                api_key: 'test-key'
            });

            expect(result.success).toBe(true);
            expect(result.details.status).toBe('Connected');
        });

        it('should return error on connection failure', async () => {
            mockAxios.get.mockRejectedValue({
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 7878,
                api_key: 'test-key'
            });

            expect(result.success).toBe(false);
            expect(result.error.code).toBe('ECONNREFUSED');
        });

        it('should handle 401 unauthorized', async () => {
            mockAxios.get.mockRejectedValue({
                response: { status: 401, data: { message: 'Unauthorized' } },
                message: 'Request failed with status code 401'
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 7878,
                api_key: 'invalid-key'
            });

            expect(result.success).toBe(false);
            expect(result.error.troubleshooting).toContain('Invalid API key - check your Radarr settings');
        });

        it('should support old format with url and apiKey strings', async () => {
            mockAxios.get.mockResolvedValue({ data: { version: '5.0.0' } });
            mockAxios.create.mockReturnValue({
                get: jest.fn()
                    .mockResolvedValueOnce({ data: { version: '5.0.0' } })
                    .mockResolvedValueOnce({ data: [] })
                    .mockResolvedValueOnce({ data: [] })
            });

            const result = await service.testConnection('http://localhost:7878', 'test-key');

            expect(result.success).toBe(true);
        });
    });

    describe('getRootFolders', () => {
        it('should return root folders', async () => {
            const mockFolders = [
                { id: 1, path: '/movies', freeSpace: 1000000000 },
                { id: 2, path: '/movies4k', freeSpace: 500000000 }
            ];
            mockAxios.get.mockResolvedValue({ data: mockFolders });

            const result = await service.getRootFolders('http://localhost:7878', 'test-key');

            expect(result).toEqual(mockFolders);
            expect(mockAxios.get).toHaveBeenCalledWith(
                'http://localhost:7878/api/v3/rootfolder',
                expect.objectContaining({
                    headers: { 'X-Api-Key': 'test-key' }
                })
            );
        });

        it('should throw error on failure', async () => {
            mockAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(service.getRootFolders('http://localhost:7878', 'test-key'))
                .rejects.toThrow('Failed to fetch root folders');
        });
    });

    describe('getQualityProfiles', () => {
        it('should return quality profiles', async () => {
            const mockProfiles = [
                { id: 1, name: 'HD-1080p' },
                { id: 2, name: '4K' }
            ];
            mockAxios.get.mockResolvedValue({ data: mockProfiles });

            const result = await service.getQualityProfiles('http://localhost:7878', 'test-key');

            expect(result).toEqual(mockProfiles);
        });
    });

    describe('validatePathInRootFolder', () => {
        it('should return valid when path is in root folder', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: '/movies', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:7878',
                'test-key',
                '/movies/The Matrix (1999)'
            );

            expect(result.isValid).toBe(true);
            expect(result.matchedRootFolder).toBe('/movies');
        });

        it('should return invalid when path not in root folder', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: '/movies', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:7878',
                'test-key',
                '/other/The Matrix (1999)'
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('not within any configured Radarr root folder');
        });

        it('should handle Windows paths', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: 'D:\\Movies', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:7878',
                'test-key',
                'D:\\Movies\\The Matrix (1999)'
            );

            expect(result.isValid).toBe(true);
        });

        it('should handle error gracefully', async () => {
            mockAxios.get.mockRejectedValue(new Error('API error'));

            const result = await service.validatePathInRootFolder(
                'http://localhost:7878',
                'test-key',
                '/movies/The Matrix'
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Failed to validate root folder');
        });
    });

    describe('addMovie', () => {
        it('should add movie to Radarr', async () => {
            const movieData = {
                title: 'The Matrix',
                tmdbId: 603,
                qualityProfileId: 1,
                rootFolderPath: '/movies'
            };
            mockAxios.post.mockResolvedValue({ data: { id: 1, ...movieData } });

            const result = await service.addMovie('http://localhost:7878', 'test-key', movieData);

            expect(result.id).toBe(1);
            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://localhost:7878/api/v3/movie',
                movieData,
                expect.objectContaining({
                    headers: { 'X-Api-Key': 'test-key', 'Content-Type': 'application/json' }
                })
            );
        });

        it('should throw error on failure', async () => {
            mockAxios.post.mockRejectedValue(new Error('Already exists'));

            await expect(service.addMovie('http://localhost:7878', 'test-key', {}))
                .rejects.toThrow('Failed to add movie to Radarr');
        });
    });

    describe('searchMovie', () => {
        it('should search movie by TMDB ID', async () => {
            const mockMovie = { title: 'The Matrix', tmdbId: 603 };
            mockAxios.get.mockResolvedValue({ data: mockMovie });

            const result = await service.searchMovie('http://localhost:7878', 'test-key', 603);

            expect(result).toEqual(mockMovie);
            expect(mockAxios.get).toHaveBeenCalledWith(
                'http://localhost:7878/api/v3/movie/lookup/tmdb',
                expect.objectContaining({
                    params: { tmdbId: 603 }
                })
            );
        });
    });

    describe('getTags', () => {
        it('should return formatted tags', async () => {
            mockAxios.get.mockResolvedValue({
                data: [
                    { id: 1, label: 'anime' },
                    { id: 2, label: '4k' }
                ]
            });

            const result = await service.getTags('http://localhost:7878', 'test-key');

            expect(result).toEqual([
                { id: 1, label: 'anime' },
                { id: 2, label: '4k' }
            ]);
        });
    });

    describe('getMovieByTmdbId', () => {
        it('should find movie by TMDB ID', async () => {
            mockAxios.get.mockResolvedValue({
                data: [
                    { id: 1, tmdbId: 603, title: 'The Matrix' },
                    { id: 2, tmdbId: 604, title: 'Other Movie' }
                ]
            });

            const result = await service.getMovieByTmdbId('http://localhost:7878', 'test-key', 603);

            expect(result).not.toBeNull();
            expect(result.tmdbId).toBe(603);
        });

        it('should return null when movie not found', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ id: 1, tmdbId: 999, title: 'Other Movie' }]
            });

            const result = await service.getMovieByTmdbId('http://localhost:7878', 'test-key', 603);

            expect(result).toBeNull();
        });
    });

    describe('getMovieById', () => {
        it('should return movie by ID', async () => {
            mockAxios.get.mockResolvedValue({ data: { id: 1, title: 'The Matrix' } });

            const result = await service.getMovieById('http://localhost:7878', 'test-key', 1);

            expect(result.id).toBe(1);
        });

        it('should return null on 404', async () => {
            mockAxios.get.mockRejectedValue({ response: { status: 404 } });

            const result = await service.getMovieById('http://localhost:7878', 'test-key', 999);

            expect(result).toBeNull();
        });
    });

    describe('updateMoviePath', () => {
        it('should update movie path', async () => {
            mockAxios.get.mockResolvedValue({
                data: { id: 1, title: 'The Matrix', path: '/movies/The Matrix (1999)' }
            });
            mockAxios.put.mockResolvedValue({
                data: { id: 1, title: 'The Matrix', path: '/movies4k/The Matrix (1999)' }
            });

            const result = await service.updateMoviePath(
                'http://localhost:7878',
                'test-key',
                1,
                '/movies4k/The Matrix (1999)'
            );

            expect(result.path).toBe('/movies4k/The Matrix (1999)');
        });

        it('should throw error when movie not found', async () => {
            mockAxios.get.mockRejectedValue({ response: { status: 404 } });

            await expect(
                service.updateMoviePath('http://localhost:7878', 'test-key', 999, '/new/path')
            ).rejects.toThrow('Movie not found with ID: 999');
        });
    });

    describe('getMinimumAvailabilityOptions', () => {
        it('should return availability options', () => {
            const options = service.getMinimumAvailabilityOptions();

            expect(options).toHaveLength(4);
            expect(options[0].value).toBe('announced');
            expect(options[2].value).toBe('released');
        });
    });
});
