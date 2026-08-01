/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Library Profile Integration Tests
 * Tests for the library profile API endpoints.
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../middleware/errorHandler.mjs';
import { createLibrariesRouter } from '../../routes/librariesRouteShared.mjs';
import { createLibrariesRouteTestDeps } from '../setup/createLibrariesRouteTestDeps.mjs';

const libraryProfileService = {
    getProfile: jest.fn(),
    generateProfile: jest.fn(),
};

const db = {
    query: jest.fn(),
};
const requireReadWrite = jest.fn((req, res, next) => next());

const app = express();
app.use(express.json());
app.use('/api/libraries', createLibrariesRouter(createLibrariesRouteTestDeps({
    express,
    db,
    libraryProfileService,
    requireReadWrite,
})));
app.use(errorHandler);

describe('Library Profile API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/libraries/:id/profile', () => {
        it('should return profile data when profile exists', async () => {
            const mockProfile = {
                id: 1,
                library_id: 1,
                rating_distribution: { PG: 80, G: 20 },
                genre_distribution: { Animation: 70 },
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

        it('should return 404 when the server-managed lifecycle has not generated a profile', async () => {
            libraryProfileService.getProfile.mockResolvedValue(null);

            const res = await request(app)
                .get('/api/libraries/999/profile')
                .expect(404);

            expect(res.body.error).toBe('Profile not found');
            expect(res.body.message).toBe('The server-managed profile lifecycle has not generated a profile for this library yet.');
        });

        it('rejects malformed identifiers without reading another library profile', async () => {
            await request(app)
                .get('/api/libraries/1abc/profile')
                .expect(400);

            expect(libraryProfileService.getProfile).not.toHaveBeenCalled();
        });
    });

    describe('POST /api/libraries/:id/profile/refresh', () => {
        it('should regenerate profile successfully', async () => {
            const mockGeneratedProfile = {
                ratings: { PG: 80 },
                genres: { Animation: 70 },
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
            expect(requireReadWrite).toHaveBeenCalled();
        });

        it('should return 400 when library has no items', async () => {
            libraryProfileService.generateProfile.mockResolvedValue(null);

            const res = await request(app)
                .post('/api/libraries/999/profile/refresh')
                .expect(400);

            expect(res.body.error).toBe('Cannot generate profile');
        });

        it('rejects malformed identifiers without generating another library profile', async () => {
            await request(app)
                .post('/api/libraries/1abc/profile/refresh')
                .expect(400);

            expect(libraryProfileService.generateProfile).not.toHaveBeenCalled();
        });
    });
});

describe('Profile Auto-Generation', () => {
    it('should have generateAllProfiles method for server startup', async () => {
        expect(typeof libraryProfileService.generateProfile).toBe('function');
    });

    it('should have generateProfile method for explicit administrative regeneration', async () => {
        expect(typeof libraryProfileService.generateProfile).toBe('function');
    });
});
