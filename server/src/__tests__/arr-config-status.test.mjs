import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createSettingsTestRouter } from './setup/createSettingsTestRouter.mjs';
import { createDbRowsResult, createNamedMockModule } from './helpers/mockFactory.mjs';

const db = { query: jest.fn(), pool: { connect: jest.fn() } };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', db));

let app;
const settingsRouter = createSettingsTestRouter(express, { database: db });

describe('Arr Config Status Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/settings', settingsRouter);
  });

  describe('GET /api/settings/arr-config-status', () => {
    test('should return empty array when all configs are complete', async () => {
      db.query.mockResolvedValueOnce({
        rows: [],
      });

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
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Radarr 4K' },
          { id: 2, name: null },
        ],
      });

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
        name: 'Radarr 2',
        id: 2,
        missingField: 'quality_profile_id',
      });
    });

    test('should return incomplete Sonarr configs', async () => {
      db.query.mockResolvedValueOnce({
        rows: [],
      });

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
      db.query.mockResolvedValueOnce({
        rows: [
          { id: 1, name: 'Radarr Main' },
        ],
      });

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
      db.query.mockResolvedValueOnce(createDbRowsResult());
      db.query.mockResolvedValueOnce(createDbRowsResult());

      await request(app)
        .get('/api/settings/arr-config-status')
        .expect(200);

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
