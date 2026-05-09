/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for PlexService
 */

import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';
const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { plexService: service } = await import('../services/mediaServers/plex.mjs');

describe('PlexService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHttpGet.mockReset();
    });

    describe('buildPosterUrl', () => {
        it('should build URL with token', () => {
            const url = service.buildPosterUrl('http://plex:32400', 'test-token', '/library/metadata/123/thumb');
            expect(url).toBe('http://plex:32400/library/metadata/123/thumb?X-Plex-Token=test-token');
        });

        it('should handle base URL with trailing slash', () => {
            const url = service.buildPosterUrl('http://plex:32400/', 'test-token', '/thumb');
            expect(url).toBe('http://plex:32400/thumb?X-Plex-Token=test-token');
        });

        it('should handle path without leading slash', () => {
            const url = service.buildPosterUrl('http://plex:32400', 'test-token', 'thumb');
            expect(url).toContain('/thumb?X-Plex-Token=');
        });

        it('should return null for null path', () => {
            expect(service.buildPosterUrl('http://plex:32400', 'token', null)).toBeNull();
        });

        it('should use & for URLs with existing query params', () => {
            const url = service.buildPosterUrl('http://plex:32400/thumb?size=100', 'token', '/other');
            expect(url).toContain('&X-Plex-Token=');
        });
    });

    describe('testConnection', () => {
        it('should return success on valid connection', async () => {
            mockHttpGet.mockResolvedValue({
                data: { MediaContainer: { version: '1.0' } }
            });

            const result = await service.testConnection('http://plex:32400', 'test-token');

            expect(result.success).toBe(true);
            expect(mockHttpGet).toHaveBeenCalledWith(
                'http://plex:32400/identity',
                expect.objectContaining({
                    headers: { 'X-Plex-Token': 'test-token', Accept: 'application/json' }
                })
            );
        });

        it('should return error on connection failure', async () => {
            mockHttpGet.mockRejectedValue(new Error('Connection refused'));

            const result = await service.testConnection('http://plex:32400', 'test-token');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Connection refused');
        });
    });

    describe('getLibraries', () => {
        it('should return filtered libraries', async () => {
            mockHttpGet.mockResolvedValue({
                data: {
                    MediaContainer: {
                        Directory: [
                            { key: '1', title: 'Movies', type: 'movie' },
                            { key: '2', title: 'TV Shows', type: 'show' },
                            { key: '3', title: 'Music', type: 'artist' }
                        ]
                    }
                }
            });

            const result = await service.getLibraries('http://plex:32400', 'test-token');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Movies');
            expect(result[0].media_type).toBe('movie');
            expect(result[1].name).toBe('TV Shows');
            expect(result[1].media_type).toBe('tv');
        });

        it('should throw error on failure', async () => {
            mockHttpGet.mockRejectedValue(new Error('Network error'));

            await expect(service.getLibraries('http://plex:32400', 'token'))
                .rejects.toThrow('Failed to fetch Plex libraries');
        });
    });

    describe('getLibraryItems', () => {
        it('should return formatted library items', async () => {
            mockHttpGet.mockResolvedValue({
                data: {
                    MediaContainer: {
                        totalSize: 1,
                        Metadata: [{
                            ratingKey: '123',
                            title: 'The Matrix',
                            year: 1999,
                            type: 'movie',
                            studio: 'Warner Bros',
                            Genre: [{ tag: 'Action' }, { tag: 'Sci-Fi' }],
                            Label: [{ tag: 'favorite' }],
                            Collection: [{ tag: 'Matrix Collection' }],
                            Guid: [{ id: 'tmdb://603' }, { id: 'imdb://tt0133093' }],
                            addedAt: 1609459200,
                            summary: 'A computer hacker learns about the true nature of reality'
                        }]
                    }
                }
            });

            const result = await service.getLibraryItems('http://plex:32400', 'token', '1');

            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('The Matrix');
            expect(result[0].genres).toContain('Action');
            expect(result[0].tmdb_id).toBe(603);
        });

        it('should handle empty library', async () => {
            mockHttpGet.mockResolvedValue({
                data: {
                    MediaContainer: {
                        totalSize: 0,
                        Metadata: null
                    }
                }
            });

            const result = await service.getLibraryItems('http://plex:32400', 'token', '1');

            expect(result).toHaveLength(0);
        });

        it('should use pagination options', async () => {
            mockHttpGet.mockResolvedValue({
                data: { MediaContainer: { totalSize: 0 } }
            });

            await service.getLibraryItems('http://plex:32400', 'token', '1', { offset: 50, limit: 25 });

            expect(mockHttpGet).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    params: expect.objectContaining({
                        'X-Plex-Container-Start': 50,
                        'X-Plex-Container-Size': 25
                    })
                })
            );
        });
    });

    describe('getCollections', () => {
        it('should return collections', async () => {
            mockHttpGet.mockResolvedValue({
                data: {
                    MediaContainer: {
                        Metadata: [
                            { ratingKey: '1', title: 'Collection 1', childCount: 5 },
                            { ratingKey: '2', title: 'Collection 2', childCount: 3 }
                        ]
                    }
                }
            });

            const result = await service.getCollections('http://plex:32400', 'token', '1');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Collection 1');
            expect(result[0].item_count).toBe(5);
        });

        it('should return empty array on error', async () => {
            mockHttpGet.mockRejectedValue(new Error('Not found'));

            const result = await service.getCollections('http://plex:32400', 'token', '1');

            expect(result).toEqual([]);
        });
    });

    describe('searchByProviderIds', () => {
        it('should search by TMDB ID', async () => {
            mockHttpGet.mockResolvedValue({
                data: {
                    MediaContainer: {
                        Metadata: [{ ratingKey: '123', title: 'The Matrix' }]
                    }
                }
            });

            const result = await service.searchByProviderIds('http://plex:32400', 'token', 603, 'movie');

            expect(result).not.toBeNull();
            expect(result.title).toBe('The Matrix');
            expect(mockHttpGet).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    params: { guid: 'tmdb://603' }
                })
            );
        });

        it('should return null when not found', async () => {
            mockHttpGet.mockResolvedValue({
                data: { MediaContainer: { Metadata: [] } }
            });

            const result = await service.searchByProviderIds('http://plex:32400', 'token', 999, 'movie');

            expect(result).toBeNull();
        });
    });
});
