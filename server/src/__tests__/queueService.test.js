/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const queueService = require('../services/queueService');
const db = require('../config/database');
const classificationService = require('../services/classification');

jest.mock('../config/database');
jest.mock('../services/classification');
jest.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    })
}));

// Mock dynamic requires
jest.mock('../services/omdb', () => ({
    getByTitle: jest.fn()
}), { virtual: true });

jest.mock('../services/tavily', () => ({
    getContentAdvisory: jest.fn(),
    search: jest.fn(),
    searchAnimeInfo: jest.fn()
}), { virtual: true });

jest.mock('../utils/rateLimiter', () => ({
    rateLimiters: {
        omdb: { execute: jest.fn(fn => fn()) },
        tavily: { execute: jest.fn(fn => fn()) }
    }
}));

// Mock mediaSync and scheduler for clearAndResync tests
jest.mock('../services/mediaSync', () => ({
    syncLibrary: jest.fn().mockResolvedValue({}),
    syncLibrariesFromMediaServer: jest.fn().mockResolvedValue([]),
    syncAllLibraries: jest.fn().mockResolvedValue()
}), { virtual: true });

jest.mock('../services/scheduler', () => ({
    runGapAnalysis: jest.fn().mockResolvedValue({})
}), { virtual: true });

describe('QueueService', () => {
    beforeEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
        queueService.processing = 0;
        queueService.running = false;
    });

    describe('enqueue', () => {
        it('should insert task into database', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 123 }] });

            const taskId = await queueService.enqueue('classification', { title: 'Test' });

            expect(taskId).toBe(123);
            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_queue'),
                expect.arrayContaining(['classification', expect.stringContaining('Test')])
            );
        });

        it('should handle database errors', async () => {
            db.query.mockRejectedValue(new Error('DB Error'));

            await expect(queueService.enqueue('test', {})).rejects.toThrow('DB Error');
        });
    });

    describe('processTask', () => {
        it('should process classification task success', async () => {
            const task = {
                id: 1,
                task_type: 'classification',
                payload: JSON.stringify({ title: 'Test Movie' })
            };

            classificationService.classify.mockResolvedValue({
                library: { name: 'Movies' },
                bestMatch: { type: 'movie', confidence: 90 }
            });

            // Mock db.query for completeTask
            db.query.mockResolvedValue({});

            await queueService.processTask(task);

            expect(classificationService.classify).toHaveBeenCalled();
            // Use regex to match query ignoring whitespace
            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue\s+SET status = 'completed'/),
                expect.any(Array)
            );
        });

        it('should process metadata_enrichment task (OMDb+Tavily)', async () => {
            const task = {
                id: 2,
                task_type: 'metadata_enrichment',
                payload: JSON.stringify({
                    title: 'Test Movie',
                    year: 2024,
                    itemId: 55,
                    source_library_id: 1,
                    source_library_name: 'Movies'
                })
            };

            // Mock OMDb configuration query AND update query
            db.query.mockImplementation((query) => {
                if (query.includes('SELECT * FROM omdb_config')) {
                    return Promise.resolve({ rows: [{ api_key: 'test_key', is_active: true }] });
                }
                if (query.includes('SELECT * FROM tavily_config')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [] });
            });

            await queueService.processTask(task);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE media_server_items/),
                expect.any(Array)
            );
        });
    });

    describe('startWorker', () => {
        it('should start worker loop', async () => {
            // Mock internal methods to avoid loop and DB calls
            jest.spyOn(queueService, 'resetStaleProcessingTasks').mockResolvedValue();
            jest.spyOn(queueService, 'dequeue').mockResolvedValue(null);

            // Mock setTimeout to "fast forward" or just return immediately if needed
            // But since we just want to check state change, we can call it.
            // NOTE: useFakeTimers is complex here due to loop.
            // We'll rely on running state check.

            const workerPromise = queueService.startWorker();

            // Wait for async start logic (resetStaleProcessingTasks) to resolve
            await new Promise(resolve => setImmediate(resolve));

            expect(queueService.running).toBe(true);

            // Stop it to break the loop
            queueService.stopWorker();

            await workerPromise; // Should resolve now that running is false

            expect(queueService.running).toBe(false);
        });

        it('should not start if already running', async () => {
            queueService.running = true;
            jest.spyOn(queueService, 'resetStaleProcessingTasks').mockResolvedValue();

            await queueService.startWorker();

            // Should exit immediately without calling resetStale
            expect(queueService.resetStaleProcessingTasks).not.toHaveBeenCalled();
        });
    });

    describe('dequeue', () => {
        it('should return next pending task', async () => {
            const mockTask = { id: 1, task_type: 'classification', payload: '{}' };
            // Use mockImplementation to handle the UPDATE...RETURNING query
            db.query.mockImplementation((query) => {
                if (query.includes('RETURNING')) {
                    return Promise.resolve({ rows: [mockTask] });
                }
                return Promise.resolve({ rows: [] });
            });

            const task = await queueService.dequeue();

            expect(task).toEqual(mockTask);
        });

        it('should return null when queue is empty', async () => {
            db.query.mockImplementation(() => Promise.resolve({ rows: [] }));

            const task = await queueService.dequeue();

            expect(task).toBeNull();
        });
    });

    describe('completeTask', () => {
        it('should mark task as completed', async () => {
            db.query.mockResolvedValue({});

            await queueService.completeTask(123, { success: true });

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'completed'/s),
                expect.arrayContaining([123])
            );
        });
    });

    describe('failTask', () => {
        it('should mark task as failed when max attempts reached', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Error message', 3, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'failed'/s),
                expect.arrayContaining([123, 'Error message'])
            );
        });

        it('should reschedule task for retry when attempts remain', async () => {
            db.query.mockResolvedValue({});

            await queueService.failTask(123, 'Temporary error', 1, 3);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.any(Array)
            );
        });
    });

    describe('getStats', () => {
        it('should return queue statistics', async () => {
            // getStats runs a GROUP BY query and builds stats object
            db.query.mockResolvedValueOnce({
                rows: [
                    { status: 'pending', count: '5' },
                    { status: 'processing', count: '2' },
                    { status: 'completed', count: '100' },
                    { status: 'failed', count: '3' }
                ]
            });

            const stats = await queueService.getStats();

            expect(stats.pending).toBe(5);
            expect(stats.processing).toBe(2);
            expect(stats.completed).toBe(100);
            expect(stats.failed).toBe(3);
            expect(stats.total).toBe(110);
            expect(stats).toHaveProperty('aiAvailable');
            expect(stats).toHaveProperty('workerRunning');
        });
    });

    describe('retryTask', () => {
        it('should reset failed task to pending', async () => {
            db.query.mockResolvedValue({ rowCount: 1 });

            await queueService.retryTask(123);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'pending'/s),
                expect.arrayContaining([123])
            );
        });
    });

    describe('cancelTask', () => {
        it('should mark task as cancelled', async () => {
            db.query.mockResolvedValue({ rowCount: 1 });

            await queueService.cancelTask(123);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringMatching(/UPDATE task_queue.*SET status = 'cancelled'/s),
                expect.arrayContaining([123])
            );
        });
    });

    describe('clearAndResync', () => {
        it('should delete all required tables in correct order', async () => {
            // Mock all DELETE queries to return rowCount
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ 
                        rows: [{ id: 1 }],
                        rowCount: 5 
                    });
                }
                if (query.includes('SELECT id FROM libraries')) {
                    return Promise.resolve({ rows: [] });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            const result = await queueService.clearAndResync();

            // Verify all required tables are deleted
            expect(db.query).toHaveBeenCalledWith('DELETE FROM task_queue RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM content_analysis_log');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_embeddings RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_history RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM learning_patterns RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM classification_corrections RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_rules_v2 RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_custom_rules');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_pattern_suggestions');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM library_profiles');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM media_server_collections RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM media_server_items RETURNING id');
            expect(db.query).toHaveBeenCalledWith('DELETE FROM libraries RETURNING id');

            // Verify result contains all cleared counts
            expect(result).toHaveProperty('queueCleared');
            expect(result).toHaveProperty('embeddingsCleared');
            expect(result).toHaveProperty('historyCleared');
            expect(result).toHaveProperty('patternsCleared');
            expect(result).toHaveProperty('correctionsCleared');
            expect(result).toHaveProperty('rulesCleared');
            expect(result).toHaveProperty('collectionsCleared');
            expect(result).toHaveProperty('itemsReset');
            expect(result).toHaveProperty('librariesCleared');
        });

        it('should delete tables in dependency-safe order', async () => {
            const deletionOrder = [];
            
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM task_queue')) {
                    deletionOrder.push('task_queue');
                } else if (query.includes('DELETE FROM content_analysis_log')) {
                    deletionOrder.push('content_analysis_log');
                } else if (query.includes('DELETE FROM classification_embeddings')) {
                    deletionOrder.push('classification_embeddings');
                } else if (query.includes('DELETE FROM classification_history')) {
                    deletionOrder.push('classification_history');
                } else if (query.includes('DELETE FROM library_profiles')) {
                    deletionOrder.push('library_profiles');
                } else if (query.includes('DELETE FROM media_server_collections')) {
                    deletionOrder.push('media_server_collections');
                } else if (query.includes('DELETE FROM media_server_items')) {
                    deletionOrder.push('media_server_items');
                } else if (query.includes('DELETE FROM libraries')) {
                    deletionOrder.push('libraries');
                }
                
                if (query.includes('SELECT id FROM libraries')) {
                    return Promise.resolve({ rows: [] });
                }
                
                return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
            });

            await queueService.clearAndResync();

            // Verify classification_embeddings is deleted before classification_history
            const embeddingsIndex = deletionOrder.indexOf('classification_embeddings');
            const historyIndex = deletionOrder.indexOf('classification_history');
            expect(embeddingsIndex).toBeLessThan(historyIndex);

            // Verify child tables are deleted before libraries (parent)
            const librariesIndex = deletionOrder.indexOf('libraries');
            expect(deletionOrder.indexOf('library_profiles')).toBeLessThan(librariesIndex);
            expect(deletionOrder.indexOf('media_server_collections')).toBeLessThan(librariesIndex);
            expect(deletionOrder.indexOf('media_server_items')).toBeLessThan(librariesIndex);
        });

        it('should clear in-memory caches before re-sync', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            // Set a cache flag
            queueService.omdbLimitHit = true;

            await queueService.clearAndResync();

            // Verify cache was cleared
            expect(queueService.omdbLimitHit).toBe(false);
        });

        it('should use syncAllLibraries for fresh sync', async () => {
            const mediaSyncService = require('../services/mediaSync');
            
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            await queueService.clearAndResync();

            // Wait for async background task to start
            await new Promise(resolve => setImmediate(resolve));

            // Verify syncAllLibraries is called (not individual library sync with old IDs)
            expect(mediaSyncService.syncAllLibraries).toHaveBeenCalled();
        });

        it('should not query for old library IDs after clear', async () => {
            db.query.mockImplementation((query) => {
                if (query.includes('DELETE FROM')) {
                    return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                }
                // Should NOT query for library IDs from deleted libraries table
                if (query.includes('SELECT id FROM libraries WHERE is_active')) {
                    throw new Error('Should not query deleted libraries!');
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            // Should complete without errors (not querying old library IDs)
            await expect(queueService.clearAndResync()).resolves.toBeDefined();
        });

        it('should handle errors gracefully', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            await expect(queueService.clearAndResync()).rejects.toThrow('Database error');
        });
    });

    describe('Library Mapping Preservation', () => {
        describe('buildLibrarySnapshot', () => {
            it('should capture library info and mappings with external IDs', async () => {
                db.query.mockResolvedValueOnce({
                    rows: [
                        {
                            id: 1,
                            name: 'Movies',
                            media_type: 'movie',
                            external_id: 'plex-123',
                            media_server_type: 'plex'
                        },
                        {
                            id: 2,
                            name: 'TV Shows',
                            media_type: 'tv',
                            external_id: 'plex-456',
                            media_server_type: 'plex'
                        }
                    ]
                });

                db.query.mockResolvedValueOnce({
                    rows: [
                        { id: 10, library_id: 1, arr_type: 'radarr', arr_config_id: 1 },
                        { id: 11, library_id: 2, arr_type: 'sonarr', arr_config_id: 1 }
                    ]
                });

                const snapshot = await queueService.buildLibrarySnapshot();

                expect(snapshot.libraries).toEqual({
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex'
                    },
                    2: {
                        name: 'TV Shows',
                        media_type: 'tv',
                        external_id: 'plex-456',
                        media_server_type: 'plex'
                    }
                });

                expect(snapshot.mappings).toHaveLength(2);
            });

            it('should handle empty library table', async () => {
                db.query.mockResolvedValueOnce({ rows: [] });
                db.query.mockResolvedValueOnce({ rows: [] });

                const snapshot = await queueService.buildLibrarySnapshot();

                expect(snapshot.libraries).toEqual({});
                expect(snapshot.mappings).toEqual([]);
            });
        });

        describe('buildNewLibraryLookup', () => {
            it('should create lookup tables by external_id and name+type', async () => {
                db.query.mockResolvedValueOnce({
                    rows: [
                        {
                            id: 10,
                            name: 'Movies',
                            media_type: 'movie',
                            external_id: 'plex-123',
                            media_server_type: 'plex'
                        },
                        {
                            id: 20,
                            name: 'TV Shows',
                            media_type: 'tv',
                            external_id: 'plex-456',
                            media_server_type: 'plex'
                        }
                    ]
                });

                const lookup = await queueService.buildNewLibraryLookup();

                expect(lookup.byExternalId['plex:plex-123']).toBe(10);
                expect(lookup.byExternalId['plex:plex-456']).toBe(20);
                expect(lookup.byNameType['movies|movie']).toBe(10);
                expect(lookup.byNameType['tv shows|tv']).toBe(20);
            });
        });

        describe('findNewLibraryId', () => {
            const newLookup = {
                byExternalId: {
                    'plex:plex-123': 10,
                    'emby:emby-abc': 20
                },
                byNameType: {
                    'movies|movie': 10,
                    'tv shows|tv': 20
                }
            };

            it('should match by external_id first (highest priority)', () => {
                const oldLibInfo = {
                    name: 'Movies',
                    media_type: 'movie',
                    external_id: 'plex-123',
                    media_server_type: 'plex'
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(10);
            });

            it('should fallback to name+type if external_id not found', () => {
                const oldLibInfo = {
                    name: 'Movies',
                    media_type: 'movie',
                    external_id: 'plex-999', // Not in lookup
                    media_server_type: 'plex'
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(10); // Found by name+type
            });

            it('should return null if no match found', () => {
                const oldLibInfo = {
                    name: 'Anime',
                    media_type: 'tv',
                    external_id: 'plex-999',
                    media_server_type: 'plex'
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBeNull();
            });

            it('should handle missing external_id gracefully', () => {
                const oldLibInfo = {
                    name: 'TV Shows',
                    media_type: 'tv',
                    media_server_type: 'plex'
                };

                const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                expect(newId).toBe(20); // Found by name+type
            });
        });

        describe('remapInstanceMappings', () => {
            const snapshot = {
                libraries: {
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex'
                    },
                    2: {
                        name: 'TV Shows',
                        media_type: 'tv',
                        external_id: 'plex-456',
                        media_server_type: 'plex'
                    }
                },
                mappings: [
                    {
                        id: 10,
                        library_id: 1,
                        arr_type: 'radarr',
                        arr_config_id: 1,
                        arr_root_folder_id: 1,
                        arr_root_folder_path: '/movies/4k',
                        quality_profile_id: null,
                        plex_path_prefix: null,
                        arr_path_prefix: null,
                        classifarr_path_prefix: null
                    }
                ]
            };

            const newLookup = {
                byExternalId: {
                    'plex:plex-123': 100,
                    'plex:plex-456': 200
                },
                byNameType: {
                    'movies|movie': 100,
                    'tv shows|tv': 200
                }
            };

            it('should recreate all mappings for an instance', async () => {
                const config = { id: 1, name: 'Radarr 4K' };

                db.query.mockResolvedValueOnce({ rowCount: 1 }); // INSERT

                const result = await queueService.remapInstanceMappings(
                    'radarr',
                    config,
                    snapshot,
                    newLookup
                );

                expect(result.remapped).toBe(1);
                expect(result.failed).toBe(0);
                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/INSERT INTO library_arr_mappings/),
                    expect.arrayContaining([100]) // New library ID
                );
            });

            it('should track failed mappings', async () => {
                const config = { id: 1, name: 'Radarr 4K' };

                const snapshotWithUnknown = {
                    libraries: {},
                    mappings: [
                        {
                            id: 99,
                            library_id: 999, // Not in libraries
                            arr_type: 'radarr',
                            arr_config_id: 1,
                            arr_root_folder_id: 1,
                            arr_root_folder_path: '/movies/deleted',
                            quality_profile_id: null,
                            plex_path_prefix: null,
                            arr_path_prefix: null,
                            classifarr_path_prefix: null
                        }
                    ]
                };

                const result = await queueService.remapInstanceMappings(
                    'radarr',
                    config,
                    snapshotWithUnknown,
                    newLookup
                );

                expect(result.remapped).toBe(0);
                expect(result.failed).toBe(1);
                expect(result.failedLibraries).toEqual([
                    {
                        oldId: 999,
                        reason: 'Library not found in snapshot'
                    }
                ]);
            });
        });

        describe('remapAllArrMappings', () => {
            const snapshot = {
                libraries: {
                    1: {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: 'plex'
                    }
                },
                mappings: [
                    {
                        id: 100,
                        library_id: 1,
                        arr_type: 'radarr',
                        arr_config_id: 1,
                        arr_root_folder_id: 1,
                        arr_root_folder_path: '/movies',
                        quality_profile_id: null,
                        plex_path_prefix: null,
                        arr_path_prefix: null,
                        classifarr_path_prefix: null
                    }
                ]
            };

            const newLookup = {
                byExternalId: { 'plex:plex-123': 10 },
                byNameType: { 'movies|movie': 10 }
            };

            it('should remap all Radarr and Sonarr instances', async () => {
                // Mock Radarr configs
                db.query.mockResolvedValueOnce({
                    rows: [{ id: 1, name: 'Radarr 4K' }]
                });

                // Mock INSERT for Radarr mapping
                db.query.mockResolvedValueOnce({ rowCount: 1 });

                // Mock Sonarr configs
                db.query.mockResolvedValueOnce({
                    rows: [{ id: 2, name: 'Sonarr' }]
                });

                const results = await queueService.remapAllArrMappings(snapshot, newLookup);

                expect(results.totalRemapped).toBe(1);
                expect(results.totalFailed).toBe(0);
                expect(results.radarr).toHaveLength(1);
                expect(results.sonarr).toHaveLength(1);
            });
        });

        describe('createRemapFailureNotification', () => {
            it('should create notification when mappings fail', async () => {
                const results = {
                    totalFailed: 2,
                    totalRemapped: 1,
                    radarr: [
                        {
                            id: 1,
                            name: 'Radarr 4K',
                            failed: 2,
                            failedLibraries: [
                                { oldId: 1, name: 'Movies', reason: 'No match' }
                            ]
                        }
                    ],
                    sonarr: []
                };

                db.query.mockResolvedValueOnce({ rowCount: 1 });

                await queueService.createRemapFailureNotification(results);

                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/INSERT INTO app_notifications/),
                    expect.arrayContaining([
                        'warning',
                        'Some library mappings need attention',
                        expect.stringContaining('2 library mapping(s)')
                    ])
                );
            });

            it('should not create notification when no failures', async () => {
                const results = {
                    totalFailed: 0,
                    totalRemapped: 3,
                    radarr: [],
                    sonarr: []
                };

                await queueService.createRemapFailureNotification(results);

                expect(db.query).not.toHaveBeenCalled();
            });
        });

        describe('NULL handling in library matching', () => {
            describe('buildNewLibraryLookup', () => {
                it('should skip libraries with NULL media_server_type when building external_id lookup', async () => {
                    db.query.mockResolvedValueOnce({
                        rows: [
                            {
                                id: 10,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: 'plex-123',
                                media_server_type: 'plex'
                            },
                            {
                                id: 20,
                                name: 'Orphaned Library',
                                media_type: 'movie',
                                external_id: 'orphan-456',
                                media_server_type: null // No media server
                            }
                        ]
                    });

                    const lookup = await queueService.buildNewLibraryLookup();

                    // Should have external_id entry for plex library only
                    expect(lookup.byExternalId['plex:plex-123']).toBe(10);
                    expect(lookup.byExternalId['null:orphan-456']).toBeUndefined();
                    expect(lookup.byExternalId['undefined:orphan-456']).toBeUndefined();
                    
                    // Both should be in name lookup
                    expect(lookup.byNameType['movies|movie']).toBe(10);
                    expect(lookup.byNameType['orphaned library|movie']).toBe(20);
                });

                it('should skip libraries with NULL external_id when building external_id lookup', async () => {
                    db.query.mockResolvedValueOnce({
                        rows: [
                            {
                                id: 10,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: null, // No external ID
                                media_server_type: 'plex'
                            }
                        ]
                    });

                    const lookup = await queueService.buildNewLibraryLookup();

                    // Should not have external_id entry
                    expect(Object.keys(lookup.byExternalId)).toHaveLength(0);
                    
                    // Should still be in name lookup
                    expect(lookup.byNameType['movies|movie']).toBe(10);
                });
            });

            describe('findNewLibraryId', () => {
                const newLookup = {
                    byExternalId: {
                        'plex:plex-123': 10
                    },
                    byNameType: {
                        'movies|movie': 10
                    }
                };

                it('should fallback to name+type when media_server_type is NULL', () => {
                    const oldLibInfo = {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: 'plex-123',
                        media_server_type: null // NULL media server type
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    // Should match by name+type instead
                    expect(newId).toBe(10);
                });

                it('should fallback to name+type when external_id is NULL', () => {
                    const oldLibInfo = {
                        name: 'Movies',
                        media_type: 'movie',
                        external_id: null, // NULL external ID
                        media_server_type: 'plex'
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    // Should match by name+type instead
                    expect(newId).toBe(10);
                });

                it('should return null when both external_id and name+type fail to match', () => {
                    const oldLibInfo = {
                        name: 'Deleted Library',
                        media_type: 'movie',
                        external_id: null,
                        media_server_type: null
                    };

                    const newId = queueService.findNewLibraryId(oldLibInfo, newLookup);

                    expect(newId).toBeNull();
                });
            });
        });

        describe('clearAndResync with mapping preservation', () => {
            it('should preserve library mappings during CARSA', async () => {
                // Mock library snapshot
                db.query.mockImplementationOnce(() =>
                    Promise.resolve({
                        rows: [
                            {
                                id: 1,
                                name: 'Movies',
                                media_type: 'movie',
                                external_id: 'plex-123',
                                media_server_type: 'plex'
                            }
                        ]
                    })
                );

                // Mock mappings snapshot
                db.query.mockImplementationOnce(() =>
                    Promise.resolve({
                        rows: [
                            {
                                id: 10,
                                library_id: 1,
                                arr_type: 'radarr',
                                arr_config_id: 1,
                                arr_root_folder_id: 1,
                                arr_root_folder_path: '/movies'
                            }
                        ]
                    })
                );

                // Mock all DELETE queries
                db.query.mockImplementation((query) => {
                    if (query.includes('DELETE FROM')) {
                        return Promise.resolve({ rows: [{ id: 1 }], rowCount: 1 });
                    }
                    return Promise.resolve({ rows: [], rowCount: 0 });
                });

                const result = await queueService.clearAndResync();

                // Verify snapshot was built (both libraries and mappings queries)
                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/SELECT.*external_id.*FROM libraries/s)
                );

                expect(db.query).toHaveBeenCalledWith(
                    expect.stringMatching(/SELECT \* FROM library_arr_mappings/)
                );

                expect(result).toHaveProperty('librariesCleared');
            });
        });
    });
});
