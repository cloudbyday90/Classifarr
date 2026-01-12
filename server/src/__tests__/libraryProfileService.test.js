/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * LibraryProfileService Tests
 * Tests for library profile generation and scoring.
 */

const libraryProfileService = require('../services/libraryProfileService');

// Mock the database
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

const db = require('../config/database');

describe('LibraryProfileService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('generateProfile', () => {
        it('should calculate rating distribution from synced items', async () => {
            // Mock synced items query
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: ['Animation'], studio: 'Disney', metadata: {} },
                    { content_rating: 'PG', genres: ['Animation', 'Family'], studio: 'Disney', metadata: {} },
                    { content_rating: 'G', genres: ['Animation'], studio: 'Pixar', metadata: {} },
                    { content_rating: 'PG', genres: ['Comedy'], studio: 'Disney', metadata: {} },
                ]
            });
            // Mock upsert
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            expect(profile.ratings).toEqual({
                'PG': 75, // 3 out of 4
                'G': 25   // 1 out of 4
            });
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

        it('should identify exclusion ratings (0% in library)', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { content_rating: 'PG', genres: [], studio: null, metadata: {} },
                    { content_rating: 'G', genres: [], studio: null, metadata: {} },
                ]
            });
            db.query.mockResolvedValueOnce({ rows: [] });

            const profile = await libraryProfileService.generateProfile(1);

            // R, NC-17, TV-MA etc should be in exclusions
            expect(profile.exclusionRatings).toContain('R');
            expect(profile.exclusionRatings).toContain('NC-17');
            expect(profile.exclusionRatings).toContain('TV-MA');
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
                    { content_rating: 'PG', genres: [], studio: null, metadata: {} }, // Not enriched
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
            // Default mock for getProfile
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

        it('should score low for items in exclusion list', async () => {
            const score = await libraryProfileService.getProfileScore(1, {
                certification: 'R',
                genres: ['Horror']
            });

            expect(score).toBeLessThan(30);
        });

        it('should return neutral score for items with unknown attributes', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // No profile

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

            // PG + Animation should score higher than G + Comedy
            expect(scorePGAnimation).toBeGreaterThan(scoreGComedy);
        });
    });

    describe('generateAllProfiles', () => {
        it('should generate profiles for all active libraries', async () => {
            // Mock libraries query
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: 1, name: 'Kids Movies', item_count: 100 },
                    { id: 2, name: 'Adult Movies', item_count: 50 },
                ]
            });

            // Mock generateProfile for each library
            db.query.mockResolvedValueOnce({
                rows: [{ content_rating: 'PG', genres: [], studio: null, metadata: {} }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // upsert
            db.query.mockResolvedValueOnce({
                rows: [{ content_rating: 'R', genres: [], studio: null, metadata: {} }]
            });
            db.query.mockResolvedValueOnce({ rows: [] }); // upsert

            const results = await libraryProfileService.generateAllProfiles();

            expect(results).toHaveLength(2);
            expect(results.filter(r => r.success)).toHaveLength(2);
        });
    });

    describe('countDistribution', () => {
        it('should convert counts to percentages', () => {
            const items = [
                { content_rating: 'PG' },
                { content_rating: 'PG' },
                { content_rating: 'G' },
                { content_rating: 'PG' },
            ];

            const dist = libraryProfileService.countDistribution(items, 'rating');

            expect(dist.PG).toBe(75);
            expect(dist.G).toBe(25);
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
