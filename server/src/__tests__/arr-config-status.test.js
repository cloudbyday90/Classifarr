/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2025 cloudbyday90
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

const request = require('supertest');
const express = require('express');
const settingsRouter = require('../routes/settings');

// Mock database
jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

const db = require('../config/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRouter);

describe('Arr Config Status Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/settings/arr-config-status', () => {
    test('should return empty array when all configs are complete', async () => {
      // Mock Radarr configs - all have quality_profile_id
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      // Mock Sonarr configs - all have quality_profile_id
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

      expect(response.body).toHaveProperty('incompleteConfigs');
      expect(response.body.incompleteConfigs).toEqual([]);
    });

    test('should return incomplete Radarr configs', async () => {
      // Mock Radarr configs - one missing quality_profile_id
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Radarr 4K' },
          { id: 2, name: null }, // No name
        ],
      });

      // Mock Sonarr configs - all complete
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      const response = await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

      expect(response.body.incompleteConfigs).toHaveLength(2);
      expect(response.body.incompleteConfigs[0]).toMatchObject({
        type: 'Radarr',
        name: 'Radarr 4K',
        id: 1,
        missingField: 'quality_profile_id',
      });
      expect(response.body.incompleteConfigs[1]).toMatchObject({
        type: 'Radarr',
        name: 'Radarr 2', // Default name when null
        id: 2,
        missingField: 'quality_profile_id',
      });
    });

    test('should return incomplete Sonarr configs', async () => {
      // Mock Radarr configs - all complete
      db.query.mockResolvedValueOnce({
        rows: [],
      });

      // Mock Sonarr configs - one missing quality_profile_id
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 3, name: 'Sonarr Anime' },
        ],
      });

      const response = await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

      expect(response.body.incompleteConfigs).toHaveLength(1);
      expect(response.body.incompleteConfigs[0]).toMatchObject({
        type: 'Sonarr',
        name: 'Sonarr Anime',
        id: 3,
        missingField: 'quality_profile_id',
      });
    });

    test('should return both incomplete Radarr and Sonarr configs', async () => {
      // Mock Radarr configs - one incomplete
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Radarr Main' },
        ],
      });

      // Mock Sonarr configs - one incomplete
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 2, name: 'Sonarr HD' },
        ],
      });

      const response = await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

      expect(response.body.incompleteConfigs).toHaveLength(2);
      
      const radarrConfig = response.body.incompleteConfigs.find(c => c.type === 'Radarr');
      expect(radarrConfig).toBeDefined();
      expect(radarrConfig.name).toBe('Radarr Main');
      
      const sonarrConfig = response.body.incompleteConfigs.find(c => c.type === 'Sonarr');
      expect(sonarrConfig).toBeDefined();
      expect(sonarrConfig.name).toBe('Sonarr HD');
    });

    test('should handle database errors gracefully', async () => {
      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/settings/arr-config-status')
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Database connection failed');
    });

    test('should query correct tables for incomplete configs', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      db.query.mockResolvedValueOnce({ rows: [] });

      await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

      // Verify correct queries were made
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name FROM radarr_config WHERE quality_profile_id IS NULL'
      );
      expect(db.query).toHaveBeenCalledWith(
        'SELECT id, name FROM sonarr_config WHERE quality_profile_id IS NULL'
      );
    });
  });
});
