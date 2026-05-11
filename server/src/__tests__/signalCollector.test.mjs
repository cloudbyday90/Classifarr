/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Unit tests for SignalCollector service (v0.33)
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
    query: jest.fn(),
};

const mockTmdbService = {
    getMovieDetails: jest.fn(),
    getCollectionDetails: jest.fn(),
};

const mockLogger = {
    createLogger: () => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    }),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdbService));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const { SignalCollector, SIGNAL_TYPES } = await import('../services/signalCollector.mjs');
const db = mockDb;
const tmdbService = mockTmdbService;

describe('SignalCollector', () => {
    let collector;

    beforeEach(() => {
        collector = new SignalCollector();
        jest.clearAllMocks();
    });

    describe('SIGNAL_TYPES', () => {
        it('should define all required signal types', () => {
            expect(SIGNAL_TYPES.EXACT_MATCH).toBe('exact_match');
            // LEARNED_PATTERN removed (Phase 7): constant retired alongside Phase 4B injection removal.
            expect(SIGNAL_TYPES.COLLECTION_MATCH).toBe('collection_match');
            expect(SIGNAL_TYPES.KEYWORD_MATCH).toBe('keyword_match');
            expect(SIGNAL_TYPES.GENRE_MATCH).toBe('genre_match');
            expect(SIGNAL_TYPES.SOURCE_LIBRARY).toBe('source_library');
            expect(SIGNAL_TYPES.MANUAL_CORRECTION).toBe('manual_correction');
            expect(SIGNAL_TYPES.CUSTOM_RULE).toBe('custom_rule');
            expect(SIGNAL_TYPES.EXISTING_MEDIA).toBe('existing_media');
            expect(SIGNAL_TYPES.CONTENT_ANALYSIS).toBe('content_analysis');
        });
    });

    describe('constructor & reset', () => {
        it('should initialize with empty signals array', () => {
            expect(collector.getSignals()).toEqual([]);
        });

        it('should reset signals correctly', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { id: 1 }, 100);
            expect(collector.getSignals().length).toBe(1);

            collector.reset();
            expect(collector.getSignals()).toEqual([]);
        });
    });

    describe('addSignal', () => {
        it('should add a signal with all properties', () => {
            const library = { id: 1, name: 'Movies' };
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { tmdb_id: 123 }, 95, library);

            const signals = collector.getSignals();
            expect(signals.length).toBe(1);
            expect(signals[0].type).toBe(SIGNAL_TYPES.EXACT_MATCH);
            expect(signals[0].data.tmdb_id).toBe(123);
            expect(signals[0].rawScore).toBe(95);
            expect(signals[0].library).toEqual(library);
            expect(signals[0].timestamp).toBeDefined();
        });

        it('should add multiple signals', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, {}, 100);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {}, 80);
            collector.addSignal(SIGNAL_TYPES.GENRE_MATCH, {}, 60);

            expect(collector.getSignals().length).toBe(3);
        });
    });

    describe('getSignalsByType', () => {
        it('should filter signals by type', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { id: 1 }, 100);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, { id: 2 }, 80);
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { id: 3 }, 90);

            const exactMatches = collector.getSignalsByType(SIGNAL_TYPES.EXACT_MATCH);
            expect(exactMatches.length).toBe(2);
            expect(exactMatches[0].data.id).toBe(1);
            expect(exactMatches[1].data.id).toBe(3);
        });

        it('should return empty array if no matching signals', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, {}, 100);

            const customRules = collector.getSignalsByType(SIGNAL_TYPES.CUSTOM_RULE);
            expect(customRules).toEqual([]);
        });
    });

    describe('hasSignal', () => {
        it('should return true if signal type exists', () => {
            collector.addSignal(SIGNAL_TYPES.COLLECTION_MATCH, {}, 85);

            expect(collector.hasSignal(SIGNAL_TYPES.COLLECTION_MATCH)).toBe(true);
            expect(collector.hasSignal(SIGNAL_TYPES.EXACT_MATCH)).toBe(false);
        });
    });

    describe('getHighestScoringSignal', () => {
        it('should return the signal with highest rawScore', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { id: 1 }, 80);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, { id: 2 }, 95);
            collector.addSignal(SIGNAL_TYPES.GENRE_MATCH, { id: 3 }, 60);

            const highest = collector.getHighestScoringSignal();
            expect(highest.data.id).toBe(2);
            expect(highest.rawScore).toBe(95);
        });

        it('should return null for empty signals', () => {
            expect(collector.getHighestScoringSignal()).toBeNull();
        });
    });

    describe('getSignalsByLibrary', () => {
        it('should group signals by suggested library', () => {
            const lib1 = { id: 1, name: 'Movies' };
            const lib2 = { id: 2, name: 'TV Shows' };

            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, {}, 100, lib1);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {}, 80, lib1);
            collector.addSignal(SIGNAL_TYPES.GENRE_MATCH, {}, 70, lib2);

            const grouped = collector.getSignalsByLibrary();
            expect(Object.keys(grouped)).toContain('1');
            expect(Object.keys(grouped)).toContain('2');
            expect(grouped['1'].signals.length).toBe(2);
            expect(grouped['2'].signals.length).toBe(1);
        });

        it('should exclude signals without a library', () => {
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, {}, 100, null);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, {}, 80, { id: 1, name: 'Movies' });

            const grouped = collector.getSignalsByLibrary();
            expect(Object.keys(grouped).length).toBe(1);
        });
    });

    describe('checkFranchiseMembership', () => {
        it('should return collection info from TMDb for movies', async () => {
            const mockMovie = {
                belongs_to_collection: {
                    id: 1241,
                    name: 'Harry Potter Collection'
                }
            };
            tmdbService.getMovieDetails.mockResolvedValue(mockMovie);

            const result = await collector.checkFranchiseMembership(671, 'movie');

            expect(tmdbService.getMovieDetails).toHaveBeenCalledWith(671);
            expect(result).toEqual({
                collectionId: 1241,
                collectionName: 'Harry Potter Collection',
                posterPath: undefined,
                backdropPath: undefined
            });
        });

        it('should return null if no collection found', async () => {
            tmdbService.getMovieDetails.mockResolvedValue({ title: 'Standalone Movie' });

            const result = await collector.checkFranchiseMembership(123, 'movie');
            expect(result).toBeNull();
        });

        it('should return null for TV shows (collections only apply to movies)', async () => {
            const result = await collector.checkFranchiseMembership(123, 'tv');
            expect(result).toBeNull();
            expect(tmdbService.getMovieDetails).not.toHaveBeenCalled();
        });

        it('should handle API errors gracefully', async () => {
            tmdbService.getMovieDetails.mockRejectedValue(new Error('API error'));

            const result = await collector.checkFranchiseMembership(123, 'movie');
            expect(result).toBeNull();
        });
    });

    describe('findRelatedClassifiedItems', () => {
        it('should query database for items in same collection', async () => {
            const mockItems = [
                { id: 1, title: 'Movie 1', library_id: 5, library_name: 'Action Movies' },
                { id: 2, title: 'Movie 2', library_id: 5, library_name: 'Action Movies' }
            ];
            db.query.mockResolvedValue({ rows: mockItems });

            const result = await collector.findRelatedClassifiedItems(1241);

            expect(db.query).toHaveBeenCalled();
            expect(result).toEqual(mockItems);
        });

        it('should return empty array on database error', async () => {
            db.query.mockRejectedValue(new Error('DB error'));

            const result = await collector.findRelatedClassifiedItems(1241);
            expect(result).toEqual([]);
        });

        it('should return empty array when no collectionId provided', async () => {
            const result = await collector.findRelatedClassifiedItems(null);
            expect(result).toEqual([]);
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('toAIContext', () => {
        it('should serialize signals for AI consumption', () => {
            const lib = { id: 1, name: 'Anime Movies' };
            collector.addSignal(SIGNAL_TYPES.EXACT_MATCH, { title: 'Spirited Away' }, 100, lib);
            collector.addSignal(SIGNAL_TYPES.CUSTOM_RULE, { reason: 'anime' }, 85, lib);

            const context = collector.toAIContext();

            expect(typeof context).toBe('string');
            expect(context).toContain('exact_match');
            expect(context).toContain('custom_rule');
            expect(context).toContain('100%');
        });

        it('should return appropriate message for no signals', () => {
            const context = collector.toAIContext();
            expect(context).toBe('No classification signals detected.');
        });
    });

    describe('collectAll', () => {
        it('should aggregate signals from multiple detectors', async () => {
            const metadata = {
                title: 'Test Movie',
                tmdb_id: 123,
                media_type: 'movie'
            };

            const libraries = [
                { id: 1, name: 'Movies', media_type: 'movie', patterns: ['movie'] },
                { id: 2, name: 'TV Shows', media_type: 'tv', patterns: ['tv'] }
            ];

            const detectors = {
                classificationEvidenceService: {
                    findExactMatch: jest.fn().mockResolvedValue({ libraryId: 1, confidence: 100 }),
                },
            };

            // Mock franchise check to return null (no collection)
            tmdbService.getMovieDetails.mockResolvedValue({});
            db.query.mockResolvedValue({ rows: [] });

            const signals = await collector.collectAll(metadata, libraries, detectors);

            expect(Array.isArray(signals)).toBe(true);
            expect(detectors.classificationEvidenceService.findExactMatch).toHaveBeenCalledWith({ tmdbId: 123, mediaType: 'movie' });
        });

        it('supports direct collaborator detectors for existing media and exact match', async () => {
            const metadata = {
                title: 'Direct Collaborator Movie',
                tmdb_id: 123,
                media_type: 'movie'
            };
            const libraries = [
                { id: 1, name: 'Movies', media_type: 'movie', patterns: ['movie'] },
            ];
            const classificationEvidenceService = {
                findExactMatch: jest.fn().mockResolvedValue({ libraryId: 1, confidence: 97 }),
            };
            const mediaSyncLibraryStateService = {
                findExistingMedia: jest.fn().mockResolvedValue({ library_id: 1, library_name: 'Movies' }),
            };
            const neutralProfileService = {
                getProfileScore: jest.fn().mockResolvedValue(50),
            };

            collector = new SignalCollector({ libraryProfileService: neutralProfileService });
            tmdbService.getMovieDetails.mockResolvedValue({});
            db.query.mockResolvedValue({ rows: [] });

            const signals = await collector.collectAll(metadata, libraries, {
                classificationEvidenceService,
                mediaSyncLibraryStateService,
            });

            expect(classificationEvidenceService.findExactMatch).toHaveBeenCalledWith({ tmdbId: 123, mediaType: 'movie' });
            expect(mediaSyncLibraryStateService.findExistingMedia).toHaveBeenCalledWith(123, 'movie');
            expect(signals.map((signal) => signal.type)).toEqual(expect.arrayContaining([
                SIGNAL_TYPES.EXACT_MATCH,
                SIGNAL_TYPES.EXISTING_MEDIA,
            ]));
        });
    });
});
