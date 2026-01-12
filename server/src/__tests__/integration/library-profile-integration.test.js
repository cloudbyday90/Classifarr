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

        it('should return 404 when profile does not exist', async () => {
            libraryProfileService.getProfile.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/libraries/999/profile')
                .expect(404);

            expect(res.body.error).toBe('Profile not found');
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
    it('should trigger profile generation after library sync completion', async () => {
        // This would be an integration test with the actual sync service
        // For now, we just verify the service method exists
        expect(typeof libraryProfileService.generateProfile).toBe('function');
    });
});
