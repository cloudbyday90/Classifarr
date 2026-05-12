/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule, createPassThroughAuthMock, createLoggerModuleMock } from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
};
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockRadarr = {
  testConnection: jest.fn(),
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
};
jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

const mockSonarr = {
  testConnection: jest.fn(),
  getRootFolders: jest.fn(),
  getQualityProfiles: jest.fn(),
};
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

const mockOllama = {};
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

const mockTmdb = {};
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockEmbeddingProvider = {};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

const mockEmbeddingRouter = {};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

const mockCloudLLM = {};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockAiRouter = {};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockStartupService = {
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
};
jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

const mockRuntimeSettings = {
  refreshFromDatabase: jest.fn(),
};
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => createMockModule(mockRuntimeSettings));

jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => config),
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const db = mockDb;
const radarrService = mockRadarr;
const sonarrService = mockSonarr;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');
const settingsRouter = createSettingsTestRouter(express);

describe('Settings ARR route helpers', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createSettingsTestApp(settingsRouter);
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
