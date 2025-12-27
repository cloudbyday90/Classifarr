/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
 *
 * Path Mapping Tests
 */

const request = require('supertest');
const express = require('express');

// Mock the database module
jest.mock('../config/database', () => ({
    query: jest.fn()
}));

// Mock fs.promises for path verification
jest.mock('fs', () => ({
    promises: {
        stat: jest.fn()
    }
}));

const db = require('../config/database');
const fs = require('fs').promises;
const pathMappingsRouter = require('../routes/pathMappings');

describe('Path Mappings API', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/settings/path-mappings', pathMappingsRouter);
        jest.clearAllMocks();
    });

    describe('GET /api/settings/path-mappings', () => {
        test('should return all path mappings', async () => {
            const mockMappings = [
                { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true, verified: true },
                { id: 2, arr_path: '/tv', local_path: '/data/tv', is_active: true, verified: false }
            ];
            db.query.mockResolvedValue({ rows: mockMappings });

            const response = await request(app).get('/api/settings/path-mappings');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(mockMappings);
            expect(response.body.length).toBe(2);
        });

        test('should return empty array when no mappings exist', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const response = await request(app).get('/api/settings/path-mappings');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([]);
        });

        test('should return 500 on database error', async () => {
            db.query.mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/api/settings/path-mappings');

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Database error');
        });
    });

    describe('POST /api/settings/path-mappings', () => {
        test('should create a new path mapping', async () => {
            const newMapping = { arr_path: '/movies', local_path: '/data/movies' };
            const createdMapping = { id: 1, ...newMapping, is_active: true };
            db.query.mockResolvedValue({ rows: [createdMapping] });

            const response = await request(app)
                .post('/api/settings/path-mappings')
                .send(newMapping);

            expect(response.status).toBe(201);
            expect(response.body.arr_path).toBe('/movies');
            expect(response.body.local_path).toBe('/data/movies');
        });

        test('should normalize paths by removing trailing slashes', async () => {
            const newMapping = { arr_path: '/movies/', local_path: '/data/movies/' };
            db.query.mockResolvedValue({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }] });

            const response = await request(app)
                .post('/api/settings/path-mappings')
                .send(newMapping);

            expect(response.status).toBe(201);
            // Verify the query was called with normalized paths
            expect(db.query).toHaveBeenCalledWith(
                expect.any(String),
                ['/movies', '/data/movies']
            );
        });

        test('should return 400 when arr_path is missing', async () => {
            const response = await request(app)
                .post('/api/settings/path-mappings')
                .send({ local_path: '/data/movies' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });

        test('should return 400 when local_path is missing', async () => {
            const response = await request(app)
                .post('/api/settings/path-mappings')
                .send({ arr_path: '/movies' });

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('required');
        });
    });

    describe('DELETE /api/settings/path-mappings/:id', () => {
        test('should delete a path mapping', async () => {
            db.query.mockResolvedValue({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies' }] });

            const response = await request(app).delete('/api/settings/path-mappings/1');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Path mapping deleted');
        });

        test('should return 404 when mapping not found', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const response = await request(app).delete('/api/settings/path-mappings/999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Path mapping not found');
        });
    });

    describe('POST /api/settings/path-mappings/:id/verify', () => {
        test('should verify accessible path successfully', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies' }] });
            db.query.mockResolvedValueOnce({ rows: [] }); // Update query
            fs.stat.mockResolvedValue({ isDirectory: () => true });

            const response = await request(app).post('/api/settings/path-mappings/1/verify');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.verified).toBe(true);
        });

        test('should fail verification when path is not a directory', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies.txt' }] });
            fs.stat.mockResolvedValue({ isDirectory: () => false });

            const response = await request(app).post('/api/settings/path-mappings/1/verify');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.verified).toBe(false);
            expect(response.body.error).toContain('not a directory');
        });

        test('should fail verification when path does not exist', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/nonexistent' }] });
            db.query.mockResolvedValueOnce({ rows: [] }); // Update query
            fs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

            const response = await request(app).post('/api/settings/path-mappings/1/verify');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(false);
            expect(response.body.verified).toBe(false);
        });

        test('should return 404 when mapping not found', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const response = await request(app).post('/api/settings/path-mappings/999/verify');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Path mapping not found');
        });
    });
});

describe('Path Translation Service', () => {
    // Test the translatePath function in fileOperationsService
    const fileOperationsService = require('../services/fileOperationsService');

    beforeEach(() => {
        // Clear the cache before each test
        fileOperationsService.clearPathMappingsCache();
        jest.clearAllMocks();
    });

    test('should translate path when mapping exists', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }
            ]
        });

        const result = await fileOperationsService.translatePath('/movies/Title (2024)');

        expect(result).toBe('/data/movies/Title (2024)');
    });

    test('should return original path when no mapping matches', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }
            ]
        });

        const result = await fileOperationsService.translatePath('/anime/Show (2024)');

        expect(result).toBe('/anime/Show (2024)');
    });

    test('should match longest path first', async () => {
        db.query.mockResolvedValue({
            rows: [
                { id: 1, arr_path: '/media/movies/4k', local_path: '/data/4k', is_active: true },
                { id: 2, arr_path: '/media/movies', local_path: '/data/movies', is_active: true },
                { id: 3, arr_path: '/media', local_path: '/data', is_active: true }
            ]
        });

        // Should match longest path first (/media/movies/4k)
        const result = await fileOperationsService.translatePath('/media/movies/4k/Title (2024)');

        expect(result).toBe('/data/4k/Title (2024)');
    });

    test('should use cache on subsequent calls', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        // First call - should query DB
        await fileOperationsService.translatePath('/movies/Title1');
        // Second call - should use cache
        await fileOperationsService.translatePath('/movies/Title2');

        // DB should only be called once due to caching
        expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('should handle database errors gracefully', async () => {
        db.query.mockRejectedValue(new Error('Database connection lost'));

        const result = await fileOperationsService.translatePath('/movies/Title (2024)');

        // Should return original path when DB fails
        expect(result).toBe('/movies/Title (2024)');
    });

    test('should clear cache correctly', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }]
        });

        // First call
        await fileOperationsService.translatePath('/movies/Title1');
        expect(db.query).toHaveBeenCalledTimes(1);

        // Clear cache
        fileOperationsService.clearPathMappingsCache();

        // Next call should query DB again
        await fileOperationsService.translatePath('/movies/Title2');
        expect(db.query).toHaveBeenCalledTimes(2);
    });
});
