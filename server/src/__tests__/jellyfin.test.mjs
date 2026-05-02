/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for JellyfinService
 */

import { jest } from '@jest/globals';

const mockAxios = {
    get: jest.fn()
};

jest.unstable_mockModule('axios', () => ({
    default: mockAxios
}));

const { default: service } = await import('../services/mediaServers/jellyfin.mjs');

describe('JellyfinService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAxios.get.mockReset();
    });

    describe('buildPosterUrl', () => {
        it('should build poster URL with API key', () => {
            const url = service.buildPosterUrl('http://jellyfin:8096', 'test-key', 'item123');
            expect(url).toBe('http://jellyfin:8096/Items/item123/Images/Primary?api_key=test-key');
        });

        it('should handle base URL with trailing slash', () => {
            const url = service.buildPosterUrl('http://jellyfin:8096/', 'key', 'item1');
            expect(url).toBe('http://jellyfin:8096/Items/item1/Images/Primary?api_key=key');
        });

        it('should return null for null itemId', () => {
            expect(service.buildPosterUrl('http://jellyfin:8096', 'key', null)).toBeNull();
        });
    });

    describe('testConnection', () => {
        it('should return success on valid connection', async () => {
            mockAxios.get.mockResolvedValue({
                data: { Version: '10.8.0', ServerName: 'Jellyfin' }
            });

            const result = await service.testConnection('http://jellyfin:8096', 'test-key');

            expect(result.success).toBe(true);
            expect(mockAxios.get).toHaveBeenCalledWith(
                'http://jellyfin:8096/System/Info',
                expect.objectContaining({
                    headers: { 'X-Emby-Token': 'test-key' }
                })
            );
        });

        it('should return error on connection failure', async () => {
            mockAxios.get.mockRejectedValue(new Error('Connection refused'));

            const result = await service.testConnection('http://jellyfin:8096', 'test-key');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection refused');
        });
    });

    describe('getLibraries', () => {
        it('should return filtered libraries', async () => {
            mockAxios.get.mockResolvedValue({
                data: [
                    { ItemId: '1', Name: 'Movies', CollectionType: 'movies' },
                    { ItemId: '2', Name: 'TV Shows', CollectionType: 'tvshows' },
                    { ItemId: '3', Name: 'Music', CollectionType: 'music' }
                ]
            });

            const result = await service.getLibraries('http://jellyfin:8096', 'test-key');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Movies');
            expect(result[0].media_type).toBe('movie');
            expect(result[1].name).toBe('TV Shows');
            expect(result[1].media_type).toBe('tv');
        });

        it('should throw error on failure', async () => {
            mockAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(service.getLibraries('http://jellyfin:8096', 'key'))
                .rejects.toThrow('Failed to fetch Jellyfin libraries');
        });
    });

    describe('getLibraryItems', () => {
        it('should return formatted library items', async () => {
            mockAxios.get.mockResolvedValue({
                data: {
                    TotalRecordCount: 1,
                    Items: [{
                        Id: '123',
                        Name: 'The Matrix',
                        ProductionYear: 1999,
                        Type: 'Movie',
                        Genres: ['Action', 'Sci-Fi'],
                        Tags: ['favorite'],
                        Studios: [{ Name: 'Warner Bros' }],
                        ProviderIds: { Tmdb: '603', Imdb: 'tt0133093' },
                        DateCreated: '2024-01-01T00:00:00Z',
                        Overview: 'A computer hacker learns about reality'
                    }]
                }
            });

            const result = await service.getLibraryItems('http://jellyfin:8096', 'key', '1');

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('The Matrix');
            expect(result[0].genres).toContain('Action');
            expect(result[0].tmdb_id).toBe(603);
        });

        it('should handle TV shows', async () => {
            mockAxios.get.mockResolvedValue({
                data: {
                    TotalRecordCount: 1,
                    Items: [{
                        Id: '456',
                        Name: 'Breaking Bad',
                        Type: 'Series',
                        Genres: ['Drama'],
                        ProviderIds: { Tmdb: '1396', Tvdb: '81189' }
                    }]
                }
            });

            const result = await service.getLibraryItems('http://jellyfin:8096', 'key', '1');

            expect(result[0].media_type).toBe('tv');
            expect(result[0].tvdb_id).toBe(81189);
        });

        it('should use pagination options', async () => {
            mockAxios.get.mockResolvedValue({ data: { Items: [] } });

            await service.getLibraryItems('http://jellyfin:8096', 'key', '1', { offset: 50, limit: 25 });

            expect(mockAxios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    params: expect.objectContaining({
                        StartIndex: 50,
                        Limit: 25
                    })
                })
            );
        });
    });

    describe('getCollections', () => {
        it('should return collections', async () => {
            mockAxios.get.mockResolvedValue({
                data: {
                    Items: [
                        { Id: '1', Name: 'Collection 1', ChildCount: 5 },
                        { Id: '2', Name: 'Collection 2', ChildCount: 3 }
                    ]
                }
            });

            const result = await service.getCollections('http://jellyfin:8096', 'key', '1');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Collection 1');
            expect(result[0].item_count).toBe(5);
        });

        it('should return empty array on error', async () => {
            mockAxios.get.mockRejectedValue(new Error('Not found'));

            const result = await service.getCollections('http://jellyfin:8096', 'key', '1');

            expect(result).toEqual([]);
        });
    });

    describe('searchByProviderIds', () => {
        it('should search by TMDB ID', async () => {
            mockAxios.get.mockResolvedValue({
                data: {
                    Items: [{ Id: '123', Name: 'The Matrix' }]
                }
            });

            const result = await service.searchByProviderIds('http://jellyfin:8096', 'key', 603, 'movie');

            expect(result).not.toBeNull();
            expect(result.Name).toBe('The Matrix');
            expect(mockAxios.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    params: expect.objectContaining({
                        AnyProviderIdEquals: 'Tmdb.603'
                    })
                })
            );
        });

        it('should return null when not found', async () => {
            mockAxios.get.mockResolvedValue({ data: { Items: [] } });

            const result = await service.searchByProviderIds('http://jellyfin:8096', 'key', 999, 'movie');

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            mockAxios.get.mockRejectedValue(new Error('API error'));

            const result = await service.searchByProviderIds('http://jellyfin:8096', 'key', 603, 'movie');

            expect(result).toBeNull();
        });
    });

    describe('parseGuids', () => {
        it('should parse provider IDs', () => {
            const result = service.parseGuids({
                ProviderIds: { Tmdb: '603', Imdb: 'tt0133093', Tvdb: '81189' }
            });

            expect(result.tmdb_id).toBe(603);
            expect(result.imdb_id).toBe('tt0133093');
            expect(result.tvdb_id).toBe(81189);
        });

        it('should handle missing provider IDs', () => {
            const result = service.parseGuids({});

            expect(result.tmdb_id).toBeNull();
            expect(result.imdb_id).toBeNull();
            expect(result.tvdb_id).toBeNull();
        });
    });
});