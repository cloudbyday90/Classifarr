/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Tests for MediaSyncService
 */

const mockDb = {
    query: jest.fn()
};
jest.mock('../config/database', () => mockDb);

const mockPlexService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};
jest.mock('../services/plex', () => mockPlexService);

const mockEmbyService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};
jest.mock('../services/emby', () => mockEmbyService);

const mockJellyfinService = {
    getLibraryItems: jest.fn(),
    getCollections: jest.fn()
};
jest.mock('../services/jellyfin', () => mockJellyfinService);

const mockContentTypeAnalyzer = {
    analyze: jest.fn()
};
jest.mock('../services/contentTypeAnalyzer', () => mockContentTypeAnalyzer);

const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
};
jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => mockLogger)
}));



describe('MediaSyncService', () => {
    let service;

    beforeEach(() => {
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

        jest.resetModules();
        service = require('../services/mediaSync');
    });

    describe('getMediaServerService', () => {
        it('should return plex service for plex type', () => {
            const result = service.getMediaServerService('plex');
            expect(result).toBe(mockPlexService);
        });

        it('should return emby service for emby type', () => {
            const result = service.getMediaServerService('emby');
            expect(result).toBe(mockEmbyService);
        });

        it('should return jellyfin service for jellyfin type', () => {
            const result = service.getMediaServerService('jellyfin');
            expect(result).toBe(mockJellyfinService);
        });

        it('should throw error for unknown type', () => {
            expect(() => service.getMediaServerService('unknown')).toThrow(
                'Unknown media server type: unknown'
            );
        });

        it('should handle case-insensitive type', () => {
            const result = service.getMediaServerService('PLEX');
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

            mockDb.query
                .mockResolvedValueOnce({ rows: [mockLibrary] })
                .mockResolvedValueOnce({ rows: [{ id: 100 }] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ id: 1 }] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rowCount: 1 })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            mockPlexService.getLibraryItems.mockResolvedValue(mockItems);
            mockPlexService.getCollections.mockResolvedValue([]);
            mockContentTypeAnalyzer.analyze.mockResolvedValue({ analyzed: false });

            const result = await service.syncLibrary(1);

            expect(mockPlexService.getLibraryItems).toHaveBeenCalled();
            expect(result.success).toBe(true);
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

            mockDb.query
                .mockResolvedValueOnce({ rows: [mockLibrary] })
                .mockResolvedValueOnce({ rows: [{ id: 100 }] })
                .mockResolvedValueOnce({ rows: [] });

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

            mockDb.query
                .mockResolvedValueOnce({ rows: [mockLibrary] })
                .mockResolvedValueOnce({ rows: [{ id: 100 }] })
                .mockResolvedValueOnce({ rows: [] });

            mockEmbyService.getLibraryItems.mockResolvedValue([]);
            mockEmbyService.getCollections.mockResolvedValue([]);

            const result = await service.syncLibrary(1);

            expect(mockEmbyService.getLibraryItems).toHaveBeenCalled();
            expect(result.success).toBe(true);
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
});
