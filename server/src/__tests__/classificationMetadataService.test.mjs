/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDatabase = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDatabase));

const mockTmdbService = {
    getMovieDetails: jest.fn(),
    getCertification: jest.fn(),
    getTVDetails: jest.fn()
};
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdbService));

const mockTavilyService = {
    searchIMDB: jest.fn(),
    getContentAdvisory: jest.fn(),
    searchAnimeInfo: jest.fn(),
};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavilyService));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));

const db = mockDatabase;
const tmdbService = mockTmdbService;
const tavilyService = mockTavilyService;
let classificationMetadataService;

beforeAll(async () => {
    classificationMetadataService = await import('../services/classificationMetadataService.mjs');
});

// ---------------------------------------------------------------------------
// Shared TMDB response fixture
// ---------------------------------------------------------------------------
const MOVIE_DETAILS_FIXTURE = {
    title: 'The Dark Knight',
    original_title: 'The Dark Knight',
    release_date: '2008-07-18',
    overview: 'When the menace known as the Joker emerges from his mysterious past...',
    genres: [{ name: 'Action' }, { name: 'Crime' }],
    keywords: { keywords: [{ name: 'superhero' }, { name: 'gotham city' }] },
    vote_average: 9.0,
    popularity: 120.5,
    original_language: 'en',
    poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdrop_path: '/hqkIcbrOHL86UncnHIsHVcVmzue.jpg',
    belongs_to_collection: { id: 263, name: 'The Dark Knight Collection' },
    production_companies: [{ id: 1, name: 'Warner Bros.' }],
    credits: {
        cast: [
            { name: 'Christian Bale' }, { name: 'Heath Ledger' }, { name: 'Aaron Eckhart' }
        ],
        crew: [
            { job: 'Director', name: 'Christopher Nolan' },
            { job: 'Producer', name: 'Emma Thomas' }
        ]
    }
};

const TV_DETAILS_FIXTURE = {
    name: 'Breaking Bad',
    original_name: 'Breaking Bad',
    first_air_date: '2008-01-20',
    overview: 'A chemistry teacher diagnosed with cancer turns to manufacturing meth.',
    genres: [{ name: 'Drama' }, { name: 'Crime' }],
    keywords: { results: [{ name: 'drug dealer' }, { name: 'cancer' }] },
    vote_average: 9.5,
    popularity: 200.1,
    original_language: 'en',
    poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop_path: null,
    belongs_to_collection: null,
    production_companies: [{ id: 2, name: 'AMC' }],
    created_by: [{ name: 'Vince Gilligan' }],
    credits: {
        cast: [{ name: 'Bryan Cranston' }, { name: 'Aaron Paul' }]
    }
};

// ---------------------------------------------------------------------------
// parseOverseerrPayload
// ---------------------------------------------------------------------------
describe('parseOverseerrPayload', () => {
    describe('Overseerr webhook format', () => {
        test('extracts tmdbId, media_type and title from nested media object', () => {
            const payload = {
                media: { tmdbId: 12345, media_type: 'movie', title: 'The Dark Knight' },
                request: { seasons: [1, 2] }
            };
            const result = classificationMetadataService.parseOverseerrPayload(payload);

            expect(result.tmdbId).toBe(12345);
            expect(result.media_type).toBe('movie');
            expect(result.title).toBe('The Dark Knight');
            expect(result.existingMetadata.requested_seasons).toEqual([1, 2]);
        });

        test('extracts tvdbId from media.tvdbId', () => {
            const payload = {
                media: { tmdbId: 99, media_type: 'tv', tvdbId: 77777 }
            };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.existingMetadata.tvdb_id).toBe(77777);
        });

        test('extracts year from media.year', () => {
            const payload = {
                media: { tmdbId: 1, media_type: 'movie', year: 2008 }
            };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.year).toBe(2008);
        });
    });

    describe('Plex gap analysis format', () => {
        test('extracts tmdb_id and itemId at root level', () => {
            const payload = {
                tmdb_id: 54321,
                title: 'Breaking Bad',
                media_type: 'tv',
                itemId: 'plex-item-abc',
                source_library_id: 7,
                source_library_name: 'TV Shows'
            };
            const result = classificationMetadataService.parseOverseerrPayload(payload);

            expect(result.tmdbId).toBe(54321);
            expect(result.media_type).toBe('tv');
            expect(result.title).toBe('Breaking Bad');
            expect(result.existingMetadata.itemId).toBe('plex-item-abc');
            expect(result.existingMetadata.source_library_id).toBe(7);
            expect(result.existingMetadata.source_library_name).toBe('TV Shows');
        });

        test('carries full existing metadata fields', () => {
            const payload = {
                tmdb_id: 1,
                media_type: 'movie',
                title: 'Test',
                overview: 'An overview',
                genres: ['Action'],
                keywords: ['hero'],
                content_rating: 'PG-13',
                original_language: 'en',
                retry_count: 2,
                max_retries: 3,
                retry_lineage: 'abc-123'
            };
            const { existingMetadata } = classificationMetadataService.parseOverseerrPayload(payload);

            expect(existingMetadata.overview).toBe('An overview');
            expect(existingMetadata.genres).toEqual(['Action']);
            expect(existingMetadata.keywords).toEqual(['hero']);
            expect(existingMetadata.content_rating).toBe('PG-13');
            expect(existingMetadata.original_language).toBe('en');
            expect(existingMetadata.retry_count).toBe(2);
            expect(existingMetadata.max_retries).toBe(3);
            expect(existingMetadata.retry_lineage).toBe('abc-123');
        });
    });

    describe('Legacy / manual format', () => {
        test('falls back to payload.title when no media object', () => {
            const payload = { title: 'Inception', media_type: 'movie' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.title).toBe('Inception');
        });

        test('falls back to "Unknown" when no title fields present', () => {
            const result = classificationMetadataService.parseOverseerrPayload({});
            expect(result.title).toBe('Unknown');
        });

        test('defaults media_type to "movie" when not present in any field', () => {
            // Note: the subject-based detection branch is unreachable because
            // payload.media?.media_type || payload.media_type || 'movie' always produces
            // a truthy string before the !media_type guard is evaluated.
            const payload = { subject: 'New TV Request', extra: [{ value: '99' }] };
            expect(classificationMetadataService.parseOverseerrPayload(payload).media_type).toBe('movie');
        });

        test('uses extra[0].value as tmdbId fallback', () => {
            const payload = { extra: [{ value: '777' }], media_type: 'movie' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.tmdbId).toBe('777');
        });
    });

    describe('requested_seasons handling', () => {
        test('preserves array value directly', () => {
            const payload = { requested_seasons: [1, 2, 3], media_type: 'tv' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.existingMetadata.requested_seasons).toEqual([1, 2, 3]);
        });

        test('parses JSON-string value', () => {
            const payload = { requested_seasons: '[1,2]', media_type: 'tv' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.existingMetadata.requested_seasons).toEqual([1, 2]);
        });

        test('nullifies malformed JSON string', () => {
            const payload = { requested_seasons: 'not-json', media_type: 'tv' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.existingMetadata.requested_seasons).toBeNull();
        });

        test('nullifies non-array value', () => {
            const payload = { requested_seasons: 'Season 1', media_type: 'tv' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.existingMetadata.requested_seasons).toBeNull();
        });
    });

    describe('taskId extraction', () => {
        test('extracts taskId when present', () => {
            const payload = { taskId: 'task-abc-123', media_type: 'movie' };
            const result = classificationMetadataService.parseOverseerrPayload(payload);
            expect(result.taskId).toBe('task-abc-123');
        });

        test('returns undefined taskId when absent', () => {
            const result = classificationMetadataService.parseOverseerrPayload({ media_type: 'movie' });
            expect(result.taskId).toBeUndefined();
        });
    });

    test('include_specials defaults to false when not present', () => {
        const result = classificationMetadataService.parseOverseerrPayload({ media_type: 'tv' });
        expect(result.existingMetadata.include_specials).toBe(false);
    });

    test('include_specials is true when explicitly set', () => {
        const result = classificationMetadataService.parseOverseerrPayload({ media_type: 'tv', include_specials: true });
        expect(result.existingMetadata.include_specials).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// enrichWithTMDB
// ---------------------------------------------------------------------------
describe('enrichWithTMDB', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('movie path', () => {
        test('returns shaped metadata with Director from credits.crew', async () => {
            tmdbService.getMovieDetails.mockResolvedValue(MOVIE_DETAILS_FIXTURE);
            tmdbService.getCertification.mockResolvedValue('PG-13');

            const result = await classificationMetadataService.enrichWithTMDB(12345, 'movie');

            expect(result.tmdb_id).toBe(12345);
            expect(result.media_type).toBe('movie');
            expect(result.title).toBe('The Dark Knight');
            expect(result.original_title).toBe('The Dark Knight');
            expect(result.year).toBe('2008');
            expect(result.genres).toEqual(['Action', 'Crime']);
            expect(result.keywords).toEqual(['superhero', 'gotham city']);
            expect(result.certification).toBe('PG-13');
            expect(result.rating).toBe(9.0);
            expect(result.cast).toHaveLength(3);
            expect(result.director_name).toBe('Christopher Nolan');
            expect(result.belongs_to_collection).toEqual({ id: 263, name: 'The Dark Knight Collection' });
            expect(result.production_companies).toEqual([{ id: 1, name: 'Warner Bros.' }]);
        });

        test('returns null director_name when no Director credit present', async () => {
            const fixture = {
                ...MOVIE_DETAILS_FIXTURE,
                credits: {
                    cast: [],
                    crew: [{ job: 'Producer', name: 'Emma Thomas' }]
                }
            };
            tmdbService.getMovieDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('R');

            const result = await classificationMetadataService.enrichWithTMDB(1, 'movie');
            expect(result.director_name).toBeNull();
        });

        test('handles keywords in .results format', async () => {
            const fixture = {
                ...MOVIE_DETAILS_FIXTURE,
                keywords: { results: [{ name: 'heist' }, { name: 'thriller' }] }
            };
            tmdbService.getMovieDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('R');

            const result = await classificationMetadataService.enrichWithTMDB(1, 'movie');
            expect(result.keywords).toEqual(['heist', 'thriller']);
        });

        test('defaults to empty array when no keywords object', async () => {
            const fixture = { ...MOVIE_DETAILS_FIXTURE, keywords: null };
            tmdbService.getMovieDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('NR');

            const result = await classificationMetadataService.enrichWithTMDB(1, 'movie');
            expect(result.keywords).toEqual([]);
        });

        test('truncates cast to 10 entries', async () => {
            const fixture = {
                ...MOVIE_DETAILS_FIXTURE,
                credits: {
                    cast: Array.from({ length: 20 }, (_, i) => ({ name: `Actor ${i}` })),
                    crew: []
                }
            };
            tmdbService.getMovieDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('PG');

            const result = await classificationMetadataService.enrichWithTMDB(1, 'movie');
            expect(result.cast).toHaveLength(10);
        });

        test('sets belongs_to_collection to null when absent', async () => {
            const fixture = { ...MOVIE_DETAILS_FIXTURE, belongs_to_collection: undefined };
            tmdbService.getMovieDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('PG');

            const result = await classificationMetadataService.enrichWithTMDB(1, 'movie');
            expect(result.belongs_to_collection).toBeNull();
        });
    });

    describe('TV path', () => {
        test('returns shaped metadata using name/first_air_date and created_by showrunner', async () => {
            tmdbService.getTVDetails.mockResolvedValue(TV_DETAILS_FIXTURE);
            tmdbService.getCertification.mockResolvedValue('TV-MA');

            const result = await classificationMetadataService.enrichWithTMDB(99, 'tv');

            expect(result.title).toBe('Breaking Bad');
            expect(result.original_title).toBe('Breaking Bad');
            expect(result.year).toBe('2008');
            expect(result.director_name).toBe('Vince Gilligan');
            expect(result.keywords).toEqual(['drug dealer', 'cancer']);
            expect(result.certification).toBe('TV-MA');
        });

        test('returns null director_name when created_by is empty', async () => {
            const fixture = { ...TV_DETAILS_FIXTURE, created_by: [] };
            tmdbService.getTVDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('TV-14');

            const result = await classificationMetadataService.enrichWithTMDB(99, 'tv');
            expect(result.director_name).toBeNull();
        });

        test('returns null director_name when created_by is absent', async () => {
            const fixture = { ...TV_DETAILS_FIXTURE };
            delete fixture.created_by;
            tmdbService.getTVDetails.mockResolvedValue(fixture);
            tmdbService.getCertification.mockResolvedValue('TV-14');

            const result = await classificationMetadataService.enrichWithTMDB(99, 'tv');
            expect(result.director_name).toBeNull();
        });
    });

    describe('error handling', () => {
        test('wraps TMDB service error with descriptive message', async () => {
            tmdbService.getMovieDetails.mockRejectedValue(new Error('TMDB API 503'));

            await expect(
                classificationMetadataService.enrichWithTMDB(1, 'movie')
            ).rejects.toThrow('Failed to enrich metadata: TMDB API 503');
        });
    });
});

// ---------------------------------------------------------------------------
// mightBeAnime
// ---------------------------------------------------------------------------
describe('mightBeAnime', () => {
    test('returns true for anime keyword', () => {
        expect(classificationMetadataService.mightBeAnime({
            keywords: ['anime'], genres: []
        })).toBe(true);
    });

    test('returns true for Japanese original language', () => {
        expect(classificationMetadataService.mightBeAnime({
            keywords: [], genres: [], original_language: 'ja'
        })).toBe(true);
    });

    test('returns true for anime genre', () => {
        expect(classificationMetadataService.mightBeAnime({
            keywords: [], genres: ['Anime']
        })).toBe(true);
    });

    test.each(['shounen', 'shoujo', 'seinen', 'isekai', 'mecha'])(
        'returns true for sub-genre keyword "%s"',
        (keyword) => {
            expect(classificationMetadataService.mightBeAnime({
                keywords: [keyword], genres: []
            })).toBe(true);
        }
    );

    test('returns false for non-anime metadata', () => {
        expect(classificationMetadataService.mightBeAnime({
            keywords: ['superhero', 'action'],
            genres: ['Action', 'Adventure'],
            original_language: 'en'
        })).toBe(false);
    });

    test('handles missing keywords/genres gracefully', () => {
        expect(classificationMetadataService.mightBeAnime({})).toBe(false);
        expect(classificationMetadataService.mightBeAnime({ keywords: null, genres: null })).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// detectEventTypesFromMetadata
// ---------------------------------------------------------------------------
describe('detectEventTypesFromMetadata', () => {
    test.each([
        ['holiday', { title: 'A Christmas Story', keywords: [], genres: [] }],
        ['holiday', { title: 'Normal Movie', keywords: ['xmas'], genres: [] }],
        ['holiday', { title: 'Normal Movie', keywords: [], genres: [], overview: 'A Halloween night' }],
        ['sports', { title: 'Super Bowl LVII', keywords: [], genres: [] }],
        ['sports', { title: 'Normal', keywords: ['nfl'], genres: [] }],
        ['ppv', { title: 'UFC 300', keywords: [], genres: [] }],
        ['ppv', { title: 'Normal', keywords: ['boxing'], genres: [] }],
        ['concert', { title: 'Live Tour 2025', keywords: [], genres: [] }],
        ['concert', { title: 'Normal', keywords: ['unplugged'], genres: [] }],
        ['standup', { title: 'Comedy Special', keywords: [], genres: [] }],
        ['standup', { title: 'Normal', keywords: ['stand-up'], genres: [] }],
        ['awards', { title: 'The Oscars 2025', keywords: [], genres: [] }],
        ['awards', { title: 'Normal', keywords: ['emmys'], genres: [] }],
    ])('detects "%s" event type', (expectedType, metadata) => {
        const result = classificationMetadataService.detectEventTypesFromMetadata(metadata);
        expect(result).toContain(expectedType);
    });

    test('returns empty array for non-event metadata', () => {
        const result = classificationMetadataService.detectEventTypesFromMetadata({
            title: 'The Dark Knight',
            overview: 'A superhero crime thriller.',
            keywords: ['superhero'],
            genres: ['Action']
        });
        expect(result).toEqual([]);
    });

    test('can match multiple event types simultaneously', () => {
        const result = classificationMetadataService.detectEventTypesFromMetadata({
            title: 'Christmas Comedy Special',
            keywords: ['comedian'],
            genres: [],
            overview: ''
        });
        expect(result).toContain('holiday');
        expect(result).toContain('standup');
    });

    test('handles missing keywords/genres/overview gracefully', () => {
        const result = classificationMetadataService.detectEventTypesFromMetadata({ title: 'Test' });
        expect(Array.isArray(result)).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// enrichWithWebSearch
// ---------------------------------------------------------------------------
describe('enrichWithWebSearch', () => {
    const baseMetadata = {
        title: 'The Dark Knight',
        year: '2008',
        media_type: 'movie',
        keywords: ['superhero'],
        genres: ['Action'],
        original_language: 'en'
    };

    beforeEach(() => {
        db.query.mockReset();
        tavilyService.searchIMDB.mockReset();
        tavilyService.getContentAdvisory.mockReset();
        tavilyService.searchAnimeInfo.mockReset();
        // Default: no active Tavily config
        db.query.mockResolvedValue({ rows: [] });
    });

    test('returns null when no active Tavily config exists', async () => {
        // default beforeEach already returns empty rows
        const result = await classificationMetadataService.enrichWithWebSearch(baseMetadata);
        expect(result).toBeNull();
    });

    test('returns null when Tavily config has no api_key', async () => {
        db.query.mockResolvedValue({ rows: [{ is_active: true, api_key: null }] });

        const result = await classificationMetadataService.enrichWithWebSearch(baseMetadata);
        expect(result).toBeNull();
    });

    test('returns imdb + advisory for non-anime metadata', async () => {
        db.query.mockResolvedValue({
            rows: [{ is_active: true, api_key: 'tvly-secret', search_depth: 'advanced', max_results: 5 }]
        });
        tavilyService.searchIMDB.mockResolvedValue({ rating: '9.0' });
        tavilyService.getContentAdvisory.mockResolvedValue({ violence: 'mild' });

        const result = await classificationMetadataService.enrichWithWebSearch(baseMetadata);

        expect(result).toEqual({
            imdb: { rating: '9.0' },
            advisory: { violence: 'mild' }
        });
        expect(tavilyService.searchAnimeInfo).not.toHaveBeenCalled();
    });

    test('includes anime field when metadata signals anime', async () => {
        db.query.mockResolvedValue({
            rows: [{ is_active: true, api_key: 'tvly-secret', max_results: 5 }]
        });
        const animeMetadata = { ...baseMetadata, original_language: 'ja', keywords: ['anime'], genres: [] };
        tavilyService.searchIMDB.mockResolvedValue({ rating: '8.5' });
        tavilyService.getContentAdvisory.mockResolvedValue(null);
        tavilyService.searchAnimeInfo.mockResolvedValue({ myAnimeListScore: 9.1 });

        const result = await classificationMetadataService.enrichWithWebSearch(animeMetadata);

        expect(result).toEqual({
            imdb: { rating: '8.5' },
            advisory: null,
            anime: { myAnimeListScore: 9.1 }
        });
        expect(tavilyService.searchAnimeInfo).toHaveBeenCalledWith(
            animeMetadata.title,
            expect.objectContaining({ apiKey: 'tvly-secret' })
        );
    });

    test('returns null and logs info on 432 monthly quota error', async () => {
        db.query.mockResolvedValue({
            rows: [{ is_active: true, api_key: 'tvly-secret', max_results: 5 }]
        });
        const quotaError = new Error('quota exceeded');
        quotaError.status = 432;
        tavilyService.searchIMDB.mockRejectedValue(quotaError);

        const result = await classificationMetadataService.enrichWithWebSearch(baseMetadata);
        expect(result).toBeNull();
    });

    test('returns null and logs error on unexpected Tavily failure', async () => {
        db.query.mockResolvedValue({
            rows: [{ is_active: true, api_key: 'tvly-secret', max_results: 5 }]
        });
        tavilyService.searchIMDB.mockRejectedValue(new Error('network error'));

        const result = await classificationMetadataService.enrichWithWebSearch(baseMetadata);
        expect(result).toBeNull();
    });

    test('passes Tavily config options through to service calls', async () => {
        db.query.mockResolvedValue({
            rows: [{
                is_active: true,
                api_key: 'tvly-key',
                search_depth: 'basic',
                max_results: 3,
                include_domains: ['imdb.com'],
                exclude_domains: ['reddit.com']
            }]
        });
        tavilyService.searchIMDB.mockResolvedValue(null);
        tavilyService.getContentAdvisory.mockResolvedValue(null);

        await classificationMetadataService.enrichWithWebSearch(baseMetadata);

        expect(tavilyService.searchIMDB).toHaveBeenCalledWith(
            baseMetadata.title,
            baseMetadata.year,
            baseMetadata.media_type,
            expect.objectContaining({
                apiKey: 'tvly-key',
                searchDepth: 'basic',
                maxResults: 3,
                includeDomains: ['imdb.com'],
                excludeDomains: ['reddit.com']
            })
        );
    });
});

// ---------------------------------------------------------------------------
// getTavilyConfig
// ---------------------------------------------------------------------------
describe('getTavilyConfig', () => {
    beforeEach(() => {
        db.query.mockReset();
        db.query.mockResolvedValue({ rows: [] });
    });

    test('returns the first active config row', async () => {
        const row = { id: 1, is_active: true, api_key: 'key123' };
        db.query.mockResolvedValue({ rows: [row] });

        const result = await classificationMetadataService.getTavilyConfig();
        expect(result).toEqual(row);
        expect(db.query).toHaveBeenCalledWith(
            'SELECT * FROM tavily_config WHERE is_active = true LIMIT 1'
        );
    });

    test('returns null when no active config exists', async () => {
        // default beforeEach already returns empty rows
        const result = await classificationMetadataService.getTavilyConfig();
        expect(result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// mergeMetadataForRecheck — focused edge cases
// (core behavior is already covered in classification.test.js)
// ---------------------------------------------------------------------------
describe('mergeMetadataForRecheck', () => {
    test('returns copy of original when enrichedMetadata is null', () => {
        const original = { title: 'Test', genres: ['Drama'] };
        const result = classificationMetadataService.mergeMetadataForRecheck(original, null);
        expect(result).toEqual(original);
        expect(result).not.toBe(original); // must be a copy
    });

    test('returns copy of original when enrichedMetadata is undefined', () => {
        const original = { title: 'Test', genres: ['Drama'] };
        const result = classificationMetadataService.mergeMetadataForRecheck(original, undefined);
        expect(result).toEqual(original);
    });

    test('replaces empty genres with enriched genres', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { genres: [] },
            { genres: ['Action', 'Drama'] }
        );
        expect(result.genres).toEqual(['Action', 'Drama']);
    });

    test('keeps existing genres when enriched list is shorter', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { genres: ['Action', 'Drama', 'Thriller'] },
            { genres: ['Action'] }
        );
        expect(result.genres).toEqual(['Action', 'Drama', 'Thriller']);
    });

    test('does not replace genres when enriched is empty', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { genres: ['Drama'] },
            { genres: [] }
        );
        expect(result.genres).toEqual(['Drama']);
    });

    test('replaces short overview with longer richer one', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { overview: 'Short.' },
            { overview: 'A much longer, richer authoritative overview that adds significant context for classification.' }
        );
        expect(result.overview).toContain('authoritative');
    });

    test('does not replace overview if incoming is only slightly longer (< 20 chars more) and existing is long', () => {
        const existing = 'An overview that is definitely long enough to qualify as sufficient context for classification purposes.';
        const incoming = existing + ' One extra bit.'; // 15 chars more — below the 20-char threshold

        const result = classificationMetadataService.mergeMetadataForRecheck(
            { overview: existing },
            { overview: incoming }
        );
        expect(result.overview).toBe(existing);
    });

    test('does not replace overview with empty string', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { overview: 'Existing overview.' },
            { overview: '' }
        );
        expect(result.overview).toBe('Existing overview.');
    });

    test('replaces belongs_to_collection with longer-named version', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { belongs_to_collection: { name: 'TDK' } },
            { belongs_to_collection: { name: 'The Dark Knight Collection' } }
        );
        expect(result.belongs_to_collection.name).toBe('The Dark Knight Collection');
    });

    test('does not replace belongs_to_collection with shorter-named version', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { belongs_to_collection: { name: 'The Dark Knight Collection' } },
            { belongs_to_collection: { name: 'TDK' } }
        );
        expect(result.belongs_to_collection.name).toBe('The Dark Knight Collection');
    });

    test('preserves all non-merged fields from original', () => {
        const result = classificationMetadataService.mergeMetadataForRecheck(
            { title: 'Test', tmdb_id: 42, year: '2020', custom_field: 'keep' },
            { genres: ['Drama'] }
        );
        expect(result.title).toBe('Test');
        expect(result.tmdb_id).toBe(42);
        expect(result.year).toBe('2020');
        expect(result.custom_field).toBe('keep');
    });
});
