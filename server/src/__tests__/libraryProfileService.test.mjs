/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * LibraryProfileService Tests
 * Tests for library profile generation and scoring.
 */

import { jest } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock} from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { libraryProfileService } = await import('../services/libraryProfileService.mjs');
const db = mockDb;

describe('LibraryProfileService', () => {
    beforeEach(() => {
        db.query.mockReset();
    });

    describe('generateProfile', () => {
        it('should calculate rating distribution from synced items', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: ['Animation'], studio: 'Disney', metadata: {}, media_type: 'movie' },
                    { content_rating: 'PG', genres: ['Animation', 'Family'], studio: 'Disney', metadata: {}, media_type: 'movie' },
                    { content_rating: 'G', genres: ['Animation'], studio: 'Pixar', metadata: {}, media_type: 'movie' },
                    { content_rating: 'PG', genres: ['Comedy'], studio: 'Disney', metadata: {}, media_type: 'movie' },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.ratings).toEqual({
                'PG': 75,
                'G': 25
            });
        });

        it('normalizes age-based TV ratings before calculating rating distribution', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: '16', genres: [], studio: null, metadata: {}, media_type: 'tv' },
                    { content_rating: '17', genres: [], studio: null, metadata: {}, media_type: 'tv' },
                    { content_rating: '18', genres: [], studio: null, metadata: {}, media_type: 'tv' },
                    { content_rating: 'TV-MA', genres: [], studio: null, metadata: {}, media_type: 'tv' },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.ratings).toEqual({ 'TV-MA': 100 });
            expect(profile.exclusionRatings).not.toContain('TV-MA');
        });

        it('should calculate genre distribution from synced items', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: ['Animation', 'Family'], studio: 'Disney', metadata: {} },
                    { content_rating: 'PG', genres: ['Animation', 'Comedy'], studio: 'Pixar', metadata: {} },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.genres.Animation).toBe(100);
            expect(profile.genres.Family).toBe(50);
            expect(profile.genres.Comedy).toBe(50);
        });

        it('does not turn absent ratings into exclusions', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: [], studio: null, metadata: {} },
                    { content_rating: 'G', genres: [], studio: null, metadata: {} },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.exclusionRatings).toEqual([]);
            expect(profile.exclusionRatings).not.toContain('PG');
            expect(profile.exclusionRatings).not.toContain('G');
        });

        it('should handle empty libraries gracefully', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile).toBeNull();
        });

        it('should count enriched items correctly', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: [], studio: null, metadata: { omdb: { rated: 'PG' } } },
                    { content_rating: 'PG', genres: [], studio: null, metadata: { tmdb: { id: 123 } } },
                    { content_rating: 'PG', genres: [], studio: null, metadata: {} },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.itemCount).toBe(3);
            expect(profile.enrichedCount).toBe(2);
        });
    });

    describe('getProfileScore', () => {
        beforeEach(() => {
            db.query.mockResolvedValue({
                rows: [{
                    library_id: 1,
                    rating_distribution: { 'PG': 80, 'G': 15, 'PG-13': 5 },
                    genre_distribution: { 'Animation': 70, 'Family': 50, 'Comedy': 30 },
                    studio_distribution: { 'Disney': 60, 'Pixar': 25 },
                    keyword_distribution: {},
                    exclusion_ratings: ['R', 'NC-17', 'TV-MA'],
                    exclusion_genres: ['Horror'],
                    exclusion_keywords: []
                }]
            });
        });

        it('should score high for items matching library profile', async () => {
            const score = await libraryProfileService.getProfileScore(1, {
                certification: 'PG',
                genres: ['Animation', 'Family']
            });

            expect(score).toBeGreaterThan(70);
        });

        it('keeps absent profile values neutral even when historical exclusions exist', async () => {
            const score = await libraryProfileService.getProfileScore(1, {
                certification: 'R',
                genres: ['Horror']
            });

            expect(score).toBe(50);
        });

        it('should return neutral score for items with unknown attributes', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const score = await libraryProfileService.getProfileScore(1, {
                certification: 'PG',
                genres: ['Animation']
            });

            expect(score).toBe(50);
        });

        it('should combine rating + genre signals correctly', async () => {
            const scorePGAnimation = await libraryProfileService.getProfileScore(1, {
                certification: 'PG',
                genres: ['Animation']
            });

            const scoreGComedy = await libraryProfileService.getProfileScore(1, {
                certification: 'G',
                genres: ['Comedy']
            });

            expect(scorePGAnimation).toBeGreaterThan(scoreGComedy);
        });

        it('should fold legacy age-based TV rating buckets before scoring', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    library_id: 20,
                    rating_distribution: {
                        '16': 11,
                        '17': 5,
                        '18': 3,
                        'TV-MA': 4
                    },
                    genre_distribution: { 'Comedy': 30 },
                    keyword_distribution: {},
                    exclusion_ratings: ['G', 'PG', 'PG-13'],
                    exclusion_genres: [],
                    exclusion_keywords: []
                }]
            });

            const score = await libraryProfileService.getProfileScore(20, {
                certification: 'TV-MA',
                genres: ['Comedy']
            });

            expect(score).toBeGreaterThan(70);
        });

        it('does not penalize a normalized rating absent from the historical profile', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{
                    library_id: 20,
                    rating_distribution: { 'TV-14': 80 },
                    genre_distribution: {},
                    keyword_distribution: {},
                    exclusion_ratings: ['18'],
                    exclusion_genres: [],
                    exclusion_keywords: []
                }]
            });

            const score = await libraryProfileService.getProfileScore(20, {
                certification: 'TV-MA',
                genres: []
            });

            expect(score).toBe(50);
        });

        it('should expose bounded diagnostics for profile score contributors', async () => {
            const details = await libraryProfileService.getProfileScoreDetails(1, {
                certification: 'PG',
                genres: ['Animation', 'Unknown Genre'],
                keywords: ['office', 'unseen keyword'],
                media_type: 'movie'
            });

            expect(details.finalScore).toBeGreaterThan(70);
            expect(details.diagnostics).toEqual(expect.objectContaining({
                schema_version: 1,
                available: true,
                media_type: 'movie',
                rating: expect.objectContaining({
                    input: 'PG',
                    normalized: 'PG',
                    distribution_percent: 80,
                    score_delta: 30,
                    matched: true,
                }),
                genres: expect.objectContaining({
                    matched: expect.arrayContaining([
                        expect.objectContaining({
                            value: 'Animation',
                            distribution_percent: 70,
                            score_delta: 15,
                        }),
                    ]),
                    unmatched: expect.arrayContaining(['Unknown Genre']),
                }),
            }));
            expect(details.diagnostics.keywords.input_count).toBe(2);
        });
    });

    describe('generateAllProfiles', () => {
        it('should generate profiles for all active libraries', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Kids Movies', item_count: 100 },
                    { id: 2, name: 'Adult Movies', item_count: 50 },
                ]
            });

            db.query.mockResolvedValueOnce({
                rows: [{ content_rating: 'PG', genres: [], studio: null, metadata: {} }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });
            db.query.mockResolvedValueOnce({
                rows: [{ content_rating: 'R', genres: [], studio: null, metadata: {} }]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const results = await libraryProfileService.generateAllProfiles();

            expect(results).toHaveLength(2);
            expect(results.filter(r => r.success)).toHaveLength(2);
        });
    });

    describe('countDistribution', () => {
        it('should convert counts to percentages', () => {
            const items = [
                { content_rating: 'PG', media_type: 'movie' },
                { content_rating: 'PG', media_type: 'movie' },
                { content_rating: 'G', media_type: 'movie' },
                { content_rating: 'PG', media_type: 'movie' },
            ];

            const dist = libraryProfileService.countDistribution(items, 'rating');

            expect(dist.PG).toBe(75);
            expect(dist.G).toBe(25);
        });

        it('normalizes rating values before counting distribution', () => {
            const items = [
                { content_rating: '16', media_type: 'tv' },
                { content_rating: '17', media_type: 'tv' },
                { content_rating: '18', media_type: 'tv' },
                { content_rating: 'TV-MA', media_type: 'tv' },
            ];

            const dist = libraryProfileService.countDistribution(items, 'rating');

            expect(dist).toEqual({ 'TV-MA': 100 });
        });

        it('should handle array fields like genres', () => {
            const items = [
                { genres: ['Action', 'Comedy'] },
                { genres: ['Action', 'Drama'] },
            ];

            const dist = libraryProfileService.countDistribution(items, 'genres');

            expect(dist.Action).toBe(100);
            expect(dist.Comedy).toBe(50);
            expect(dist.Drama).toBe(50);
        });

        it('should normalize object-shaped genres and keywords when counting distributions', () => {
            const genreDist = libraryProfileService.countDistribution([
                { genres: [{ id: 1, name: 'Action' }, { id: 2, name: 'Comedy' }], metadata: {} },
                { genres: [{ id: 1, name: 'Action' }, { id: 3, name: 'Drama' }], metadata: {} },
            ], 'genres');

            const keywordDist = libraryProfileService.countDistribution([
                { metadata: { tmdb: { keywords: [{ id: 10, name: 'hero' }, { id: 11, name: 'villain' }] } } },
                { metadata: { tmdb: { keywords: [{ id: 10, name: 'hero' }] } } },
            ], 'keywords');

            expect(genreDist.Action).toBe(100);
            expect(genreDist.Comedy).toBe(50);
            expect(genreDist.Drama).toBe(50);
            expect(keywordDist.hero).toBe(100);
            expect(keywordDist.villain).toBe(50);
        });
    });

    describe('findExclusions', () => {
        it('should return known values not in distribution', () => {
            const distribution = { 'PG': 50, 'G': 50 };
            const knownValues = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

            const exclusions = libraryProfileService.findExclusions(distribution, knownValues);

            expect(exclusions).toContain('PG-13');
            expect(exclusions).toContain('R');
            expect(exclusions).toContain('NC-17');
            expect(exclusions).not.toContain('G');
            expect(exclusions).not.toContain('PG');
        });
    });
});
