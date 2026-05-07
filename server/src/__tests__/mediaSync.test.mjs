/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for MediaSyncService
 */

import { jest } from '@jest/globals';
import { createMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn()
};
jest.unstable_mockModule('../config/database.mjs', () => createMockModule(mockDb));

const mockPlexService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};

const mockEmbyService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};

const mockJellyfinService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};

const mockGetMediaServerService = jest.fn((type) => {
    switch (String(type).toLowerCase()) {
        case 'plex':
            return mockPlexService;
        case 'emby':
            return mockEmbyService;
        case 'jellyfin':
            return mockJellyfinService;
        default:
            throw new Error(`Unknown media server type: ${type}`);
    }
});

const mockContentTypeAnalyzer = {
    analyze: jest.fn()
};
jest.unstable_mockModule('../services/contentTypeAnalyzer.mjs', () => createMockModule(mockContentTypeAnalyzer));

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};

const mockLoggerModule = {
    createLogger: jest.fn(() => mockLogger)
};
jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLoggerModule));

describe('MediaSyncService', () => {
    let service;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockDb.query.mockReset();
        mockPlexService.getLibraryItems.mockReset();
        mockPlexService.getCollections.mockReset();
        mockEmbyService.getLibraryItems.mockReset();
        mockEmbyService.getCollections.mockReset();
        mockJellyfinService.getLibraryItems.mockReset();
        mockJellyfinService.getCollections.mockReset();
        mockContentTypeAnalyzer.analyze.mockReset();
        mockLogger.info.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockGetMediaServerService.mockClear();

        jest.resetModules();
        ({ default: service } = await import('../services/mediaSync.mjs'));
        service.mediaServerServices = {
            getMediaServerService: mockGetMediaServerService
        };
    });

    describe('getMediaServerService', () => {
        it('should return plex service for plex type', async () => {
            const result = await service.getMediaServerService('plex');
            expect(result).toBe(mockPlexService);
        });

        it('should return emby service for emby type', async () => {
            const result = await service.getMediaServerService('emby');
            expect(result).toBe(mockEmbyService);
        });

        it('should return jellyfin service for jellyfin type', async () => {
            const result = await service.getMediaServerService('jellyfin');
            expect(result).toBe(mockJellyfinService);
        });

        it('should throw error for unknown type', async () => {
            await expect(service.getMediaServerService('unknown')).rejects.toThrow(
                'Unknown media server type: unknown'
            );
        });

        it('should handle case-insensitive type', async () => {
            const result = await service.getMediaServerService('PLEX');
            expect(result).toBe(mockPlexService);
        });
    });

    describe('findExistingMedia', () => {
        it('should return existing media item', async () => {
            const mockItem = {
                id: 1,
                tmdb_id: 12345,
                title: 'Test Movie',
                library_id: 1,
                library_name: 'Movies'
            };
            mockDb.query.mockResolvedValue({ rows: [mockItem] });

            const result = await service.findExistingMedia(12345, 'movie');

            expect(result).toEqual(mockItem);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('FROM media_server_items msi'),
                [12345, 'movie']
            );
        });

        it('should return null when no media found', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            const result = await service.findExistingMedia(99999, 'movie');

            expect(result).toBeNull();
        });

        it('should handle database errors gracefully', async () => {
            mockDb.query.mockRejectedValue(new Error('DB error'));

            const result = await service.findExistingMedia(12345, 'movie');

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error finding existing media',
                expect.objectContaining({ tmdbId: 12345 })
            );
        });
    });

    describe('getLibraryContext', () => {
        it('should return library context for existing media', async () => {
            const mockItem = {
                id: 1,
                tmdb_id: 12345,
                title: 'Test Movie',
                year: 2020,
                library_id: 1,
                library_name: 'Movies',
                added_at: '2024-01-01',
                collections: ['Collection 1'],
                tags: ['tag1']
            };
            mockDb.query.mockResolvedValue({ rows: [mockItem] });

            const result = await service.getLibraryContext(12345, { media_type: 'movie' });

            expect(result).toEqual({
                exists: true,
                library_id: 1,
                library_name: 'Movies',
                title: 'Test Movie',
                year: 2020,
                added_at: '2024-01-01',
                collections: ['Collection 1'],
                tags: ['tag1']
            });
        });

        it('should return null when media not found', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            const result = await service.getLibraryContext(99999, { media_type: 'movie' });

            expect(result).toBeNull();
        });
    });

    describe('getSyncStatus', () => {
        it('should return sync status for specific library', async () => {
            const mockStatus = [
                { id: 1, library_id: 1, status: 'completed', library_name: 'Movies' }
            ];
            mockDb.query.mockResolvedValue({ rows: mockStatus });

            const result = await service.getSyncStatus(1);

            expect(result).toEqual(mockStatus);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE ss.library_id = $1'),
                [1]
            );
        });

        it('should return all sync statuses when no libraryId', async () => {
            const mockStatus = [
                { id: 1, library_id: 1, status: 'completed' },
                { id: 2, library_id: 2, status: 'running' }
            ];
            mockDb.query.mockResolvedValue({ rows: mockStatus });

            const result = await service.getSyncStatus();

            expect(result).toEqual(mockStatus);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY ss.created_at DESC'),
                []
            );
        });

        it('should return empty array on error', async () => {
            mockDb.query.mockRejectedValue(new Error('DB error'));

            const result = await service.getSyncStatus(1);

            expect(result).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalled();
        });
    });

    describe('getLibraryItems', () => {
        it('should return items and total count', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Movie 1' }, { id: 2, title: 'Movie 2' }] })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] });

            const result = await service.getLibraryItems(1, { limit: 50, offset: 0 });

            expect(result.items).toHaveLength(2);
            expect(result.total).toBe(2);
        });

        it('should throw LibraryNotFoundError for missing library', async () => {
            mockDb.query.mockResolvedValueOnce({ rows: [] });

            await expect(service.getLibraryItems(999)).rejects.toThrow('Library not found: 999');
        });

        it('should use default limit and offset', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] });

            await service.getLibraryItems(1);

            const itemsQuery = mockDb.query.mock.calls.find(
                call => call[0].includes('FROM media_server_items')
            );
            expect(itemsQuery[1]).toEqual([1, 50, 0]);
        });
    });

    describe('syncLibrary', () => {
        it('should throw LibraryNotFoundError for missing library', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            await expect(service.syncLibrary(999)).rejects.toThrow('Library not found: 999');
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Library not found during sync',
                { libraryId: 999 }
            );
        });

        it('should sync library with Plex', async () => {
            const mockLibrary = {
                id: 1,
                name: 'Movies',
                type: 'plex',
                url: 'http://plex:32400',
                api_key: 'test-token',
                media_server_id: 1,
                external_id: '1'
            };

            const mockItems = [
                { external_id: '1', title: 'Movie 1', tmdb_id: 123 },
                { external_id: '2', title: 'Movie 2', tmdb_id: 456 }
            ];

            mockDb.query.mockImplementation((sql) => {
                if (sql.includes('FROM libraries l')) {
                    return Promise.resolve({ rows: [mockLibrary] });
                }
                if (sql.includes('INSERT INTO media_server_sync_status')) {
                    return Promise.resolve({ rows: [{ id: 100 }] });
                }
                if (sql === 'SELECT id FROM libraries WHERE id = $1') {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                if (sql.includes('INSERT INTO media_server_items')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes('SET items_total = $1, items_processed = $2')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                if (sql.includes('DELETE FROM media_server_items')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                if (sql.includes('DELETE FROM media_server_collections')) {
                    return Promise.resolve({ rowCount: 2 });
                }
                if (sql.includes('UPDATE classification_history ch')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes("SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3")) {
                    return Promise.resolve({ rowCount: 1 });
                }
                throw new Error(`Unexpected query: ${sql}`);
            });

            mockPlexService.getLibraryItems.mockResolvedValue(mockItems);
            mockPlexService.getCollections.mockResolvedValue([]);
            mockContentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });

            const result = await service.syncLibrary(1);

            expect(mockPlexService.getLibraryItems).toHaveBeenCalled();
            expect(result.success).toBe(true);
            expect(result.prunedItems).toBe(1);
            expect(result.prunedCollections).toBe(2);
        });

        it('should mark sync as failed on error', async () => {
            const mockLibrary = {
                id: 1,
                name: 'Movies',
                type: 'plex',
                url: 'http://plex:32400',
                api_key: 'test-token',
                media_server_id: 1,
                external_id: '1'
            };

            mockDb.query
                .mockResolvedValueOnce({ rows: [mockLibrary] })
                .mockResolvedValueOnce({ rows: [{ id: 100 }] });

            mockPlexService.getLibraryItems.mockRejectedValue(new Error('Plex API error'));

            await expect(service.syncLibrary(1)).rejects.toThrow('Plex API error');

            const failCall = mockDb.query.mock.calls.find(
                call => call[0].includes("SET status = $1, error_message = $2")
            );
            expect(failCall[1]).toEqual(['failed', 'Plex API error', 100]);
        });

        it('should sync with Jellyfin', async () => {
            const mockLibrary = {
                id: 1,
                name: 'Movies',
                type: 'jellyfin',
                url: 'http://jellyfin:8096',
                api_key: 'test-key',
                media_server_id: 1,
                external_id: 'library-1'
            };

            mockDb.query.mockImplementation((sql) => {
                if (sql.includes('FROM libraries l')) {
                    return Promise.resolve({ rows: [mockLibrary] });
                }
                if (sql.includes('INSERT INTO media_server_sync_status')) {
                    return Promise.resolve({ rows: [{ id: 100 }] });
                }
                if (sql.includes('DELETE FROM media_server_items')) {
                    return Promise.resolve({ rowCount: 0 });
                }
                if (sql.includes('DELETE FROM media_server_collections')) {
                    return Promise.resolve({ rowCount: 0 });
                }
                if (sql.includes('UPDATE classification_history ch')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes("SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3")) {
                    return Promise.resolve({ rowCount: 1 });
                }
                throw new Error(`Unexpected query: ${sql}`);
            });

            mockJellyfinService.getLibraryItems.mockResolvedValue([]);
            mockJellyfinService.getCollections.mockResolvedValue([]);

            const result = await service.syncLibrary(1);

            expect(mockJellyfinService.getLibraryItems).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should sync with Emby', async () => {
            const mockLibrary = {
                id: 1,
                name: 'Movies',
                type: 'emby',
                url: 'http://emby:8096',
                api_key: 'test-key',
                media_server_id: 1,
                external_id: 'library-1'
            };

            mockDb.query.mockImplementation((sql) => {
                if (sql.includes('FROM libraries l')) {
                    return Promise.resolve({ rows: [mockLibrary] });
                }
                if (sql.includes('INSERT INTO media_server_sync_status')) {
                    return Promise.resolve({ rows: [{ id: 100 }] });
                }
                if (sql.includes('DELETE FROM media_server_items')) {
                    return Promise.resolve({ rowCount: 0 });
                }
                if (sql.includes('DELETE FROM media_server_collections')) {
                    return Promise.resolve({ rowCount: 0 });
                }
                if (sql.includes('UPDATE classification_history ch')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes("SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3")) {
                    return Promise.resolve({ rowCount: 1 });
                }
                throw new Error(`Unexpected query: ${sql}`);
            });

            mockEmbyService.getLibraryItems.mockResolvedValue([]);
            mockEmbyService.getCollections.mockResolvedValue([]);

            const result = await service.syncLibrary(1);

            expect(mockEmbyService.getLibraryItems).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should not prune unseen rows during incremental sync', async () => {
            const mockLibrary = {
                id: 1,
                name: 'Movies',
                type: 'plex',
                url: 'http://plex:32400',
                api_key: 'test-token',
                media_server_id: 1,
                external_id: '1'
            };

            mockDb.query.mockImplementation((sql) => {
                if (sql.includes('FROM libraries l')) {
                    return Promise.resolve({ rows: [mockLibrary] });
                }
                if (sql.includes('INSERT INTO media_server_sync_status')) {
                    return Promise.resolve({ rows: [{ id: 100 }] });
                }
                if (sql === 'SELECT id FROM libraries WHERE id = $1') {
                    return Promise.resolve({ rows: [{ id: 1 }] });
                }
                if (sql.includes('INSERT INTO media_server_items')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes('SET items_total = $1, items_processed = $2')) {
                    return Promise.resolve({ rowCount: 1 });
                }
                if (sql.includes('UPDATE classification_history ch')) {
                    return Promise.resolve({ rows: [] });
                }
                if (sql.includes("SET status = $1, completed_at = NOW(), items_total = $2, items_processed = $3")) {
                    return Promise.resolve({ rowCount: 1 });
                }
                throw new Error(`Unexpected query: ${sql}`);
            });

            mockPlexService.getLibraryItems.mockResolvedValue([{ external_id: '1', title: 'Movie 1', tmdb_id: 123 }]);
            mockPlexService.getCollections.mockResolvedValue([]);
            mockContentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });

            const pruneItemsSpy = jest.spyOn(service, 'pruneMissingMediaItems');
            const pruneCollectionsSpy = jest.spyOn(service, 'pruneMissingCollections');

            const result = await service.syncLibrary(1, { incremental: true, batchSize: 50 });

            expect(result.success).toBe(true);
            expect(pruneItemsSpy).not.toHaveBeenCalled();
            expect(pruneCollectionsSpy).not.toHaveBeenCalled();
        });
    });

    describe('upsertMediaItem', () => {
        it('should skip if library no longer exists', async () => {
            mockDb.query.mockResolvedValue({ rows: [] });

            await service.upsertMediaItem(1, 999, { external_id: 'item-1' });

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('library 999 no longer exists'),
                expect.any(Object)
            );
        });

        it('should normalize object-shaped genres, tags, and collections before analysis and upsert', async () => {
            mockDb.query
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // library exists
                .mockResolvedValueOnce({ rows: [] }); // upsert

            mockContentTypeAnalyzer.analyze.mockResolvedValue({
                analyzed: false
            });

            const item = {
                external_id: 'item-2',
                title: 'Test Movie',
                media_type: 'movie',
                genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Comedy' }],
                tags: [{ id: 3, name: 'hero' }],
                collections: [{ id: 4, name: 'Saga' }],
                metadata: { summary: 'Overview' }
            };

            await service.upsertMediaItem(1, 10, item);

            expect(mockContentTypeAnalyzer.analyze).toHaveBeenCalledWith(expect.objectContaining({
                genres: ['Action', 'Comedy'],
                keywords: ['hero']
            }), null, true);

            const upsertCall = mockDb.query.mock.calls[1];
            expect(upsertCall[1][10]).toEqual(['Action', 'Comedy']);
            expect(upsertCall[1][11]).toEqual(['hero']);
            expect(upsertCall[1][12]).toEqual(['Saga']);
        });
    });

    describe('full-sync pruning helpers', () => {
        it('pruneMissingMediaItems deletes all cached rows when the remote library is empty', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 4 });

            const result = await service.pruneMissingMediaItems(7, []);

            expect(result).toBe(4);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM media_server_items'),
                [7]
            );
        });

        it('pruneMissingCollections preserves seen external ids during full sync', async () => {
            mockDb.query.mockResolvedValue({ rowCount: 2 });

            const result = await service.pruneMissingCollections(9, ['collection-a', 'collection-b']);

            expect(result).toBe(2);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM media_server_collections'),
                [9, ['collection-a', 'collection-b']]
            );
        });
    });
});
