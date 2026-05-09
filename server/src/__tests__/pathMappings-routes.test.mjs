/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const query = jest.fn();
const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const stat = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => ({
  default: {
    query,
  },
}));

jest.unstable_mockModule('../config/database.mjs', () => ({
  query,
  default: {
    query,
  },
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
}));

jest.unstable_mockModule('node:fs/promises', () => ({
  default: {
    stat,
  },
}));

const { router: pathMappingsRouter } = await import('../routes/pathMappings.mjs');

describe('Path Mappings API Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/settings/path-mappings', pathMappingsRouter);
  });

  describe('GET /api/settings/path-mappings', () => {
    test('should return all path mappings', async () => {
      const mockMappings = [
        { id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true, verified: true },
        { id: 2, arr_path: '/tv', local_path: '/data/tv', is_active: true, verified: false },
      ];
      query.mockResolvedValue({ rows: mockMappings });

      const response = await request(app).get('/api/settings/path-mappings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMappings);
      expect(response.body.length).toBe(2);
    });

    test('should return empty array when no mappings exist', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/settings/path-mappings');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    test('should return 500 on database error', async () => {
      query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/settings/path-mappings');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('POST /api/settings/path-mappings', () => {
    test('should create a new path mapping', async () => {
      const newMapping = { arr_path: '/movies', local_path: '/data/movies' };
      const createdMapping = { id: 1, ...newMapping, is_active: true };
      query.mockResolvedValue({ rows: [createdMapping] });

      const response = await request(app)
        .post('/api/settings/path-mappings')
        .send(newMapping);

      expect(response.status).toBe(201);
      expect(response.body.arr_path).toBe('/movies');
      expect(response.body.local_path).toBe('/data/movies');
    });

    test('should normalize paths by removing trailing slashes', async () => {
      const newMapping = { arr_path: '/movies/', local_path: '/data/movies/' };
      query.mockResolvedValue({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies', is_active: true }] });

      const response = await request(app)
        .post('/api/settings/path-mappings')
        .send(newMapping);

      expect(response.status).toBe(201);
      expect(query).toHaveBeenCalledWith(
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
      query.mockResolvedValue({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies' }] });

      const response = await request(app).delete('/api/settings/path-mappings/1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Path mapping deleted');
    });

    test('should return 404 when mapping not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app).delete('/api/settings/path-mappings/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Path mapping not found');
    });
  });

  describe('POST /api/settings/path-mappings/:id/verify', () => {
    test('should verify accessible path successfully', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies' }] });
      query.mockResolvedValueOnce({ rows: [] });
      stat.mockResolvedValue({ isDirectory: () => true });

      const response = await request(app).post('/api/settings/path-mappings/1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.verified).toBe(true);
    });

    test('should fail verification when path is not a directory', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/data/movies.txt' }] });
      stat.mockResolvedValue({ isDirectory: () => false });

      const response = await request(app).post('/api/settings/path-mappings/1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.verified).toBe(false);
      expect(response.body.error).toContain('not a directory');
    });

    test('should fail verification when path does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1, arr_path: '/movies', local_path: '/nonexistent' }] });
      query.mockResolvedValueOnce({ rows: [] });
      stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const response = await request(app).post('/api/settings/path-mappings/1/verify');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.verified).toBe(false);
    });

    test('should return 404 when mapping not found', async () => {
      query.mockResolvedValue({ rows: [] });

      const response = await request(app).post('/api/settings/path-mappings/999/verify');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Path mapping not found');
    });
  });
});
