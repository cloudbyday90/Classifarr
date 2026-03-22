/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../services/radarr', () => ({
  testConnection: jest.fn(),
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
}));

jest.mock('../services/sonarr', () => ({
  testConnection: jest.fn(),
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
}));

jest.mock('../services/ollama', () => ({}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/embeddingProvider', () => ({}));
jest.mock('../services/embeddingRouter', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/cloudLLM', () => ({}));
jest.mock('../services/aiRouter', () => ({}));
jest.mock('../services/tavily', () => ({
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
}));
jest.mock('../services/startupService', () => ({
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
}));
jest.mock('../config/runtimeSettings', () => ({
  refreshFromDatabase: jest.fn(),
}));
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));
jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
}));
jest.mock('../utils/ragLoopConfig', () => ({
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => config),
  validateIssue275PayloadKeys: jest.fn(() => []),
}));

const db = require('../config/database');
const radarrService = require('../services/radarr');
const sonarrService = require('../services/sonarr');
const settingsRouter = require('../routes/settings');

describe('Settings ARR route helpers', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('masks API keys for GET /settings/radarr and GET /settings/sonarr', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, api_key: 'radarr-secret' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, api_key: 'sonarr-secret' }] });

    const radarrRes = await request(app).get('/settings/radarr').expect(200);
    const sonarrRes = await request(app).get('/settings/sonarr').expect(200);

    expect(radarrRes.body[0].api_key).not.toBe('radarr-secret');
    expect(sonarrRes.body[0].api_key).not.toBe('sonarr-secret');
  });

  it('preserves stored Radarr URL components and API key on partial masked updates', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Radarr Main',
          url: 'https://radarr.local:7878/base',
          api_key: 'radarr-secret',
          protocol: 'https',
          host: 'radarr.local',
          port: 7878,
          base_path: '/base',
          verify_ssl: true,
          timeout: 30,
          is_active: true,
          media_server_id: 5,
          quality_profile_id: 7,
          minimum_availability: 'released',
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Renamed Radarr',
          url: 'https://radarr.local:7878/base',
          api_key: 'radarr-secret',
          protocol: 'https',
          host: 'radarr.local',
          port: 7878,
          base_path: '/base',
          verify_ssl: true,
          timeout: 30,
          is_active: true,
          media_server_id: 5,
          quality_profile_id: 7,
          minimum_availability: 'released',
        }]
      });

    const res = await request(app)
      .put('/settings/radarr/1')
      .send({
        name: 'Renamed Radarr',
        api_key: '••••••••-masked',
      })
      .expect(200);

    expect(db.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE radarr_config'),
      expect.arrayContaining(['Renamed Radarr', 'https://radarr.local:7878/base', 'radarr-secret'])
    );
    expect(res.body.api_key).not.toBe('radarr-secret');
  });

  it('uses the stored Sonarr API key for masked /settings/sonarr/test requests', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'live-sonarr-key' }] });
    sonarrService.testConnection.mockResolvedValueOnce({ success: true });

    const res = await request(app)
      .post('/settings/sonarr/test')
      .send({
        host: 'sonarr.local',
        port: 8989,
        api_key: '••••••••-masked',
      })
      .expect(200);

    expect(sonarrService.testConnection).toHaveBeenCalledWith(expect.objectContaining({
      api_key: 'live-sonarr-key',
      host: 'sonarr.local',
      port: 8989,
    }));
    expect(res.body.success).toBe(true);
  });

  it('loads Radarr root folders through the shared config lookup handler', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 1, url: 'http://radarr.local:7878', api_key: 'radarr-secret' }] });
    radarrService.getRootFolders.mockResolvedValueOnce([{ path: '/movies' }]);

    const res = await request(app)
      .get('/settings/radarr/1/root-folders')
      .expect(200);

    expect(radarrService.getRootFolders).toHaveBeenCalledWith('http://radarr.local:7878', 'radarr-secret');
    expect(res.body).toEqual([{ path: '/movies' }]);
  });

  it('aggregates incomplete ARR configurations through the shared status handler', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Radarr Main' }] })
      .mockResolvedValueOnce({ rows: [{ id: 2, name: null }] });

    const res = await request(app)
      .get('/settings/arr-config-status')
      .expect(200);

    expect(res.body).toEqual({
      incompleteConfigs: [
        {
          type: 'Radarr',
          name: 'Radarr Main',
          id: 1,
          missingField: 'quality_profile_id'
        },
        {
          type: 'Sonarr',
          name: 'Sonarr 2',
          id: 2,
          missingField: 'quality_profile_id'
        }
      ]
    });
    expect(db.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id, name FROM radarr_config WHERE quality_profile_id IS NULL'
    );
    expect(db.query).toHaveBeenNthCalledWith(
      2,
      'SELECT id, name FROM sonarr_config WHERE quality_profile_id IS NULL'
    );
  });

  it('rejects invalid ARR ids before querying shared handlers', async () => {
    await request(app)
      .put('/settings/radarr/not-a-number')
      .send({ name: 'Bad Radarr' })
      .expect(400);

    await request(app)
      .delete('/settings/sonarr/0')
      .expect(400);

    await request(app)
      .get('/settings/radarr/not-a-number/root-folders')
      .expect(400);

    await request(app)
      .get('/settings/sonarr/0/quality-profiles')
      .expect(400);

    expect(db.query).not.toHaveBeenCalled();
  });
});
