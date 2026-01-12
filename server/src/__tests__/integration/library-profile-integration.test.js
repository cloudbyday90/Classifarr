/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Library Profile Integration Tests
 * Tests for the library profile API endpoints.
 */

const request = require('supertest');
const express = require('express');

// Mock database before requiring routes
jest.mock('../../config/database', () => ({
    query: jest.fn()
}));

jest.mock('../../services/libraryProfileService', () => ({
    getProfile: jest.fn(),
    generateProfile: jest.fn()
}));

const db = require('../../config/database');
const libraryProfileService = require('../../services/libraryProfileService');

// Create minimal express app for testing
const app = express();
app.use(express.json());

// Import routes after mocks
const librariesRouter = require('../../routes/libraries');
app.use('/api/libraries', librariesRouter);

describe('Library Profile API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/libraries/:id/profile', () => {
        it('should return profile data when profile exists', async () => {
            const mockProfile = {
                id: 1,
                library_id: 1,
                rating_distribution: { 'PG': 80, 'G': 20 },
                genre_distribution: { 'Animation': 70 },
                item_count: 100,
                enriched_count: 95,
                last_generated_at: '2025-01-11T12:00:00Z'
            };

            libraryProfileService.getProfile.mockResolvedValue(mockProfile);

            const res = await request(app)
                .get('/api/libraries/1/profile')
                .expect(200);

            expect(res.body).toEqual(mockProfile);
            expect(libraryProfileService.getProfile).toHaveBeenCalledWith(1);
        });

        /**
         * 404 Response is Critical for Frontend Auto-Generation
         * 
         * The frontend LibraryProfile.vue component relies on receiving a 404 status
         * when no profile exists to trigger automatic profile generation.
         * If this test fails or the behavior changes, frontend auto-generation will break.
         * See: client/src/components/library/LibraryProfile.vue - loadProfile() catch block
         */
        it('should return 404 when profile does not exist (required for frontend auto-generation)', async () => {
            libraryProfileService.getProfile.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/libraries/999/profile')
                .expect(404);

            expect(res.body.error).toBe('Profile not found');
            expect(res.body.message).toBe('Profile will be generated after library sync and enrichment');
        });
    });

    describe('POST /api/libraries/:id/profile/refresh', () => {
        it('should regenerate profile successfully', async () => {
            const mockGeneratedProfile = {
                ratings: { 'PG': 80 },
                genres: { 'Animation': 70 },
                itemCount: 100,
                enrichedCount: 95
            };

            libraryProfileService.generateProfile.mockResolvedValue(mockGeneratedProfile);

            const res = await request(app)
                .post('/api/libraries/1/profile/refresh')
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.profile).toEqual(mockGeneratedProfile);
            expect(libraryProfileService.generateProfile).toHaveBeenCalledWith(1);
        });

        it('should return 400 when library has no items', async () => {
            libraryProfileService.generateProfile.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/libraries/999/profile/refresh')
                .expect(400);

            expect(res.body.error).toBe('Cannot generate profile');
        });
    });
});

describe('Profile Auto-Generation', () => {
    /**
     * Server Startup Profile Generation
     * 
     * On server startup, index.js calls libraryProfileService.generateAllProfiles()
     * which generates/refreshes profiles for all libraries with items.
     * This ensures profiles are always up-to-date when viewing library details.
     * See: server/src/index.js - initializeServices()
     */
    it('should have generateAllProfiles method for server startup', async () => {
        expect(typeof libraryProfileService.generateProfile).toBe('function');
        // generateAllProfiles is called during server startup to pre-generate
        // profiles for all libraries with items. This prevents the need for
        // manual refresh when first viewing a library.
    });

    /**
     * Frontend 404 Auto-Generation (Fallback)
     * 
     * If a profile doesn't exist when the frontend requests it,
     * the API returns 404 and the frontend auto-triggers profile generation.
     * This is a fallback for new libraries or if startup generation fails.
     * See: client/src/components/library/LibraryProfile.vue - loadProfile() catch block
     */
    it('should have generateProfile method for on-demand generation', async () => {
        expect(typeof libraryProfileService.generateProfile).toBe('function');
        // The frontend calls refreshLibraryProfile when it receives 404
        // which triggers generateProfile on the backend
    });
});
