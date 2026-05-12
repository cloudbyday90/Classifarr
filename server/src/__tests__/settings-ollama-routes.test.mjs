/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule, createPassThroughAuthMock, createTransactionalDbMock, createLoggerModuleMock } from './helpers/mockFactory.mjs';
import { createSettingsTestApp } from './helpers/setupRouteTest.mjs';

const mockDb = createTransactionalDbMock();
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockRadarr = {};
jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

const mockSonarr = {};
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

const mockTmdb = {};
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockEmbeddingProvider = {
  resetConfig: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

const mockEmbeddingRouter = {
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

const mockCloudLLM = {};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockAiRouter = {
  clearCache: jest.fn(),
  getStatus: jest.fn(),
};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockOmdb = {};
jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

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
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const mockWebhook = {};
jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

const mockOllama = {
  resetConfig: jest.fn(),
  preflightConnection: jest.fn(),
  getLastScheduledPreflight: jest.fn(),
  warmModel: jest.fn(),
  warmAllModels: jest.fn(),
  getModels: jest.fn(),
  getRecommendedModels: jest.fn(),
};
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

const db = mockDb;
const ollamaService = mockOllama;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');
const settingsRouter = createSettingsTestRouter(express);

describe('Settings Ollama route helpers', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createSettingsTestApp(settingsRouter);
  });

  it('returns the active Ollama config from GET /settings/ollama', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 4,
        host: 'host.docker.internal',
        port: 11434,
        model: 'qwen3:14b',
        temperature: 0.3,
        is_active: true
      }]
    });

    const res = await request(app).get('/settings/ollama').expect(200);

    expect(res.body).toMatchObject({
      id: 4,
      host: 'host.docker.internal',
      port: 11434,
      model: 'qwen3:14b'
    });
  });

  it('preserves active Ollama fields on partial updates and resets the service cache', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    const existing = {
      id: 9,
      host: 'host.docker.internal',
      port: 11434,
      model: 'qwen3:14b',
      temperature: 0.3,
      is_active: true
    };
    const updated = {
      ...existing,
      temperature: 0.55
    };

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ollama_config WHERE is_active = true ORDER BY id ASC LIMIT 1') {
        return { rows: [existing] };
      }
      if (typeof sql === 'string' && sql.startsWith('UPDATE ollama_config SET is_active = false WHERE id <>')) {
        expect(params).toEqual([9]);
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE ollama_config')) {
        expect(params).toEqual(['host.docker.internal', 11434, 'qwen3:14b', 0.55, 9]);
        return { rows: [updated] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/ollama')
      .send({ temperature: 0.55 })
      .expect(200);

    expect(res.body).toMatchObject({
      id: 9,
      host: 'host.docker.internal',
      port: 11434,
      model: 'qwen3:14b',
      temperature: 0.55
    });
    expect(ollamaService.resetConfig).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid Ollama saves before writing a broken active row', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);
    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ollama_config WHERE is_active = true ORDER BY id ASC LIMIT 1') {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/ollama')
      .send({ host: '', port: 'not-a-port' })
      .expect(400);

    expect(res.body).toEqual({ error: 'Host is required' });
    expect(ollamaService.resetConfig).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('delegates /settings/ollama/test to the preflight service with forced connectivity checks', async () => {
    ollamaService.preflightConnection.mockResolvedValueOnce({ success: true, host: 'ollama', port: 11434 });

    const res = await request(app)
      .post('/settings/ollama/test')
      .send({ host: 'ollama', port: 11434, model: 'qwen3:14b' })
      .expect(200);

    expect(ollamaService.preflightConnection).toHaveBeenCalledWith({
      host: 'ollama',
      port: 11434,
      model: 'qwen3:14b',
      probeGeneration: false,
      force: true
    });
    expect(res.body.success).toBe(true);
  });

  it('returns the last scheduled preflight payload from /settings/ollama/preflight/last', async () => {
    ollamaService.getLastScheduledPreflight.mockReturnValueOnce({
      ai: {
        success: false,
        failureType: 'generation_timeout',
        nextScheduledAt: '2026-04-18T01:45:37.126Z'
      },
      embedding: null
    });

    const res = await request(app)
      .get('/settings/ollama/preflight/last')
      .expect(200);

    expect(ollamaService.getLastScheduledPreflight).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({
      ai: {
        success: false,
        failureType: 'generation_timeout',
        nextScheduledAt: '2026-04-18T01:45:37.126Z'
      },
      embedding: null
    });
  });

  it('passes host/port query overrides through /settings/ollama/models', async () => {
    ollamaService.getModels.mockResolvedValueOnce([{ name: 'qwen3:14b' }]);

    const res = await request(app)
      .get('/settings/ollama/models')
      .query({ host: 'ollama', port: '11435' })
      .expect(200);

    expect(ollamaService.getModels).toHaveBeenCalledWith('ollama', '11435');
    expect(res.body).toEqual([{ name: 'qwen3:14b' }]);
  });
});
