/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for SonarrService
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

describe('SonarrService', () => {
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
        service = require('../services/sonarr');
    });

    describe('buildUrl', () => {
        it('should build URL with default values', () => {
            const url = service.buildUrl({});
            expect(url).toBe('http://localhost:8989');
        });

        it('should build URL with custom values', () => {
            const url = service.buildUrl({
                protocol: 'https',
                host: 'sonarr.example.com',
                port: 443,
                base_path: '/sonarr'
            });
            expect(url).toBe('https://sonarr.example.com:443/sonarr');
        });

        it('should handle base path without leading slash', () => {
            const url = service.buildUrl({
                host: 'sonarr.local',
                base_path: 'sonarr'
            });
            expect(url).toBe('http://sonarr.local:8989/sonarr');
        });

        it('should handle base path with leading slash', () => {
            const url = service.buildUrl({
                host: 'sonarr.local',
                base_path: '/sonarr'
            });
            expect(url).toBe('http://sonarr.local:8989/sonarr');
        });
    });

    describe('testConnection', () => {
        it('should return success with connection details', async () => {
            mockAxios.get.mockResolvedValue({ data: { version: '4.0.0' } });
            mockAxios.create.mockReturnValue({
                get: jest.fn()
                    .mockResolvedValueOnce({ data: { version: '4.0.0' } })
                    .mockResolvedValueOnce({ data: [{ id: 1, name: 'HD' }] })
                    .mockResolvedValueOnce({ data: [{ id: 1, path: '/tv' }] })
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 8989,
                api_key: 'test-key'
            });

            expect(result.success).toBe(true);
            expect(result.details.status).toBe('Connected');
            expect(result.data.seriesTypeOptions).toBeDefined();
            expect(result.data.seasonMonitoringOptions).toBeDefined();
        });

        it('should return error on connection failure', async () => {
            mockAxios.get.mockRejectedValue({
                code: 'ECONNREFUSED',
                message: 'Connection refused'
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 8989,
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
                port: 8989,
                api_key: 'invalid-key'
            });

            expect(result.success).toBe(false);
            expect(result.error.troubleshooting).toContain('Invalid API key - check your Sonarr settings');
        });

        it('should handle timeout errors', async () => {
            mockAxios.get.mockRejectedValue({
                code: 'ETIMEDOUT',
                message: 'Connection timed out'
            });

            const result = await service.testConnection({
                host: 'localhost',
                port: 8989,
                api_key: 'test-key'
            });

            expect(result.success).toBe(false);
            expect(result.error.troubleshooting).toContain('Connection timed out - check network connectivity');
        });
    });

    describe('getRootFolders', () => {
        it('should return root folders', async () => {
            const mockFolders = [
                { id: 1, path: '/tv', freeSpace: 1000000000 },
                { id: 2, path: '/tv4k', freeSpace: 500000000 }
            ];
            mockAxios.get.mockResolvedValue({ data: mockFolders });

            const result = await service.getRootFolders('http://localhost:8989', 'test-key');

            expect(result).toEqual(mockFolders);
            expect(mockAxios.get).toHaveBeenCalledWith(
                'http://localhost:8989/api/v3/rootfolder',
                expect.objectContaining({
                    headers: { 'X-Api-Key': 'test-key' }
                })
            );
        });

        it('should throw error on failure', async () => {
            mockAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(service.getRootFolders('http://localhost:8989', 'test-key'))
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

            const result = await service.getQualityProfiles('http://localhost:8989', 'test-key');

            expect(result).toEqual(mockProfiles);
        });
    });

    describe('validatePathInRootFolder', () => {
        it('should return valid when path is in root folder', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: '/tv', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:8989',
                'test-key',
                '/tv/Breaking Bad'
            );

            expect(result.isValid).toBe(true);
            expect(result.matchedRootFolder).toBe('/tv');
        });

        it('should return invalid when path not in root folder', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: '/tv', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:8989',
                'test-key',
                '/other/Breaking Bad'
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('not within any configured Sonarr root folder');
        });

        it('should handle Windows paths', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ path: 'D:\\TV', freeSpace: 1000000000 }]
            });

            const result = await service.validatePathInRootFolder(
                'http://localhost:8989',
                'test-key',
                'D:\\TV\\Breaking Bad'
            );

            expect(result.isValid).toBe(true);
        });

        it('should handle error gracefully', async () => {
            mockAxios.get.mockRejectedValue(new Error('API error'));

            const result = await service.validatePathInRootFolder(
                'http://localhost:8989',
                'test-key',
                '/tv/Breaking Bad'
            );

            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Failed to validate root folder');
        });
    });

    describe('addSeries', () => {
        it('should add series to Sonarr', async () => {
            const seriesData = {
                title: 'Breaking Bad',
                tvdbId: 81189,
                qualityProfileId: 1,
                rootFolderPath: '/tv',
                seasons: [{ seasonNumber: 1, monitored: true }]
            };
            mockAxios.post.mockResolvedValue({ data: { id: 1, ...seriesData } });

            const result = await service.addSeries('http://localhost:8989', 'test-key', seriesData);

            expect(result.id).toBe(1);
            expect(mockAxios.post).toHaveBeenCalledWith(
                'http://localhost:8989/api/v3/series',
                seriesData,
                expect.objectContaining({
                    headers: { 'X-Api-Key': 'test-key', 'Content-Type': 'application/json' }
                })
            );
        });

        it('should throw error on failure', async () => {
            mockAxios.post.mockRejectedValue(new Error('Already exists'));

            await expect(service.addSeries('http://localhost:8989', 'test-key', {}))
                .rejects.toThrow('Failed to add series to Sonarr');
        });
    });

    describe('searchSeries', () => {
        it('should search series by TVDB ID', async () => {
            const mockSeries = { title: 'Breaking Bad', tvdbId: 81189 };
            mockAxios.get.mockResolvedValue({ data: [mockSeries] });

            const result = await service.searchSeries('http://localhost:8989', 'test-key', 81189);

            expect(result).toEqual([mockSeries]);
            expect(mockAxios.get).toHaveBeenCalledWith(
                'http://localhost:8989/api/v3/series/lookup',
                expect.objectContaining({
                    params: { term: 'tvdb:81189' }
                })
            );
        });
    });

    describe('getTags', () => {
        it('should return formatted tags', async () => {
            mockAxios.get.mockResolvedValue({
                data: [
                    { id: 1, label: 'anime' },
                    { id: 2, label: 'ongoing' }
                ]
            });

            const result = await service.getTags('http://localhost:8989', 'test-key');

            expect(result).toEqual([
                { id: 1, label: 'anime' },
                { id: 2, label: 'ongoing' }
            ]);
        });
    });

    describe('getSeriesByTvdbId', () => {
        it('should find series by TVDB ID', async () => {
            mockAxios.get.mockResolvedValue({
                data: [
                    { id: 1, tvdbId: 81189, title: 'Breaking Bad' },
                    { id: 2, tvdbId: 999, title: 'Other Show' }
                ]
            });

            const result = await service.getSeriesByTvdbId('http://localhost:8989', 'test-key', 81189);

            expect(result).not.toBeNull();
            expect(result.tvdbId).toBe(81189);
        });

        it('should return null when series not found', async () => {
            mockAxios.get.mockResolvedValue({
                data: [{ id: 1, tvdbId: 999, title: 'Other Show' }]
            });

            const result = await service.getSeriesByTvdbId('http://localhost:8989', 'test-key', 81189);

            expect(result).toBeNull();
        });
    });

    describe('getSeriesById', () => {
        it('should return series by ID', async () => {
            mockAxios.get.mockResolvedValue({ data: { id: 1, title: 'Breaking Bad' } });

            const result = await service.getSeriesById('http://localhost:8989', 'test-key', 1);

            expect(result.id).toBe(1);
        });

        it('should return null on 404', async () => {
            mockAxios.get.mockRejectedValue({ response: { status: 404 } });

            const result = await service.getSeriesById('http://localhost:8989', 'test-key', 999);

            expect(result).toBeNull();
        });
    });

    describe('updateSeriesPath', () => {
        it('should update series path', async () => {
            mockAxios.get.mockResolvedValue({
                data: { id: 1, title: 'Breaking Bad', path: '/tv/Breaking Bad' }
            });
            mockAxios.put.mockResolvedValue({
                data: { id: 1, title: 'Breaking Bad', path: '/tv4k/Breaking Bad' }
            });

            const result = await service.updateSeriesPath(
                'http://localhost:8989',
                'test-key',
                1,
                '/tv4k/Breaking Bad'
            );

            expect(result.path).toBe('/tv4k/Breaking Bad');
        });

        it('should include moveFiles query parameter', async () => {
            mockAxios.get.mockResolvedValue({
                data: { id: 1, title: 'Breaking Bad', path: '/tv/Breaking Bad' }
            });
            mockAxios.put.mockResolvedValue({
                data: { id: 1, path: '/tv4k/Breaking Bad' }
            });

            await service.updateSeriesPath(
                'http://localhost:8989',
                'test-key',
                1,
                '/tv4k/Breaking Bad',
                { moveFiles: true }
            );

            expect(mockAxios.put).toHaveBeenCalledWith(
                expect.stringContaining('moveFiles=true'),
                expect.any(Object),
                expect.any(Object)
            );
        });

        it('should throw error when series not found', async () => {
            mockAxios.get.mockRejectedValue({ response: { status: 404 } });

            await expect(
                service.updateSeriesPath('http://localhost:8989', 'test-key', 999, '/new/path')
            ).rejects.toThrow('Series not found with ID: 999');
        });
    });

    describe('getSeriesTypeOptions', () => {
        it('should return series type options', () => {
            const options = service.getSeriesTypeOptions();

            expect(options).toHaveLength(3);
            expect(options[0].value).toBe('standard');
            expect(options[1].value).toBe('anime');
            expect(options[2].value).toBe('daily');
        });
    });

    describe('getSeasonMonitoringOptions', () => {
        it('should return monitoring options', () => {
            const options = service.getSeasonMonitoringOptions();

            expect(options).toHaveLength(9);
            expect(options[0].value).toBe('all');
            expect(options[options.length - 1].value).toBe('none');
        });
    });
});
