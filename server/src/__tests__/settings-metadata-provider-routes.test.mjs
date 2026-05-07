/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
  withTransaction: jest.fn(async (fn) => {
    const conn = await mockDb.pool.connect();
    try {
      await conn.query('BEGIN');
      const result = await fn(conn);
      await conn.query('COMMIT');
      return result;
    } catch (err) {
      try { await conn.query('ROLLBACK'); } catch (_) {}
      throw err;
    } finally {
      conn.release();
    }
  }),
};
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockRadarr = {};
jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

const mockSonarr = {};
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

const mockOllama = {
  resetConfig: jest.fn(),
};
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

const mockTmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

const mockTavily = {
  search: jest.fn(),
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
};
jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

const mockOmdb = {
  testConnection: jest.fn(),
  checkHealth: jest.fn(),
  getByTitle: jest.fn(),
};
jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

const mockDiscordBot = {};
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockStartupService = {
  getSetupStatus: jest.fn(),
  setMediaPath: jest.fn(),
  checkMediaPathStatus: jest.fn(),
};
jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

const mockPathTestService = {};
jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

const mockEmbeddingProvider = {
  resetConfig: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

const mockEmbeddingRouter = {
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
};
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

const mockAiRouter = {
  clearCache: jest.fn(),
  getStatus: jest.fn(),
};
jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

const mockCloudLLM = {
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
};
jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

const mockWebhook = {};
jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

const mockScheduler = {
  runGapAnalysis: jest.fn().mockResolvedValue(undefined),
};
jest.unstable_mockModule('../services/scheduler.mjs', () => createNamedMockModule('schedulerService', mockScheduler));

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
};
jest.unstable_mockModule('../middleware/auth.mjs', () => createNamedMockModule('router', mockAuth));

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })
};
jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
};
mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const db = mockDb;
const tmdbService = mockTmdb;
const tavilyService = mockTavily;
const omdbService = mockOmdb;
const schedulerService = mockScheduler;
const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

describe('Settings metadata provider route helpers', () => {
  let app;
  let settingsRouter;

  beforeAll(async () => {
    settingsRouter = await createSettingsTestRouter(express);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.pool.connect.mockReset();
    tmdbService.testConnection.mockReset();
    tmdbService.checkHealth.mockReset();
    tavilyService.search.mockReset();
    tavilyService.testConnection.mockReset();
    tavilyService.checkHealth.mockReset();
    omdbService.testConnection.mockReset();
    omdbService.checkHealth.mockReset();
    omdbService.getByTitle.mockReset();
    schedulerService.runGapAnalysis.mockReset().mockResolvedValue(undefined);
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('preserves TMDB language and stored API key on partial masked updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1') {
        return { rows: [{ api_key: 'stored-tmdb-key', language: 'fr-FR' }] };
      }
      if (typeof sql === 'string' && sql.startsWith('UPDATE tmdb_config SET is_active = false')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tmdb_config')) {
        expect(params).toEqual(['stored-tmdb-key', 'fr-FR']);
        return {
          rows: [{ id: 1, api_key: 'stored-tmdb-key', language: 'fr-FR', is_active: true }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tmdb')
      .send({ api_key: '••••••••-masked' })
      .expect(200);

    expect(res.body.language).toBe('fr-FR');
    expect(res.body.api_key).not.toBe('stored-tmdb-key');
  });

  it('clears TMDB API key when empty string is submitted', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1') {
        return { rows: [{ api_key: 'stored-tmdb-key', language: 'fr-FR' }] };
      }
      if (typeof sql === 'string' && sql.startsWith('UPDATE tmdb_config SET is_active = false')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tmdb_config')) {
        expect(params).toEqual(['', 'fr-FR']);
        return {
          rows: [{ id: 1, api_key: '', language: 'fr-FR', is_active: true }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tmdb')
      .send({ api_key: '' })
      .expect(200);

    expect(res.body.api_key).toBe('');
  });

  it('preserves Tavily search settings and disabled state on partial masked updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tavily_config LIMIT 1') {
        return {
          rows: [{
            api_key: 'stored-tavily-key',
            search_depth: 'basic',
            max_results: 9,
            include_domains: ['imdb.com'],
            exclude_domains: ['example.com'],
            is_active: false
          }]
        };
      }
      if (typeof sql === 'string' && sql.startsWith('DELETE FROM tavily_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tavily_config')) {
        expect(params).toEqual([
          'stored-tavily-key',
          'basic',
          9,
          ['imdb.com'],
          ['example.com'],
          false
        ]);
        return {
          rows: [{
            api_key: 'stored-tavily-key',
            search_depth: 'basic',
            max_results: 9,
            include_domains: ['imdb.com'],
            exclude_domains: ['example.com'],
            is_active: false
          }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tavily')
      .send({ api_key: '••••••••-masked' })
      .expect(200);

    expect(res.body.search_depth).toBe('basic');
    expect(res.body.max_results).toBe(9);
    expect(res.body.is_active).toBe(false);
    expect(res.body.api_key).not.toBe('stored-tavily-key');
  });

  it('clears Tavily API key when empty string is submitted', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tavily_config LIMIT 1') {
        return {
          rows: [{
            api_key: 'stored-tavily-key',
            search_depth: 'basic',
            max_results: 9,
            include_domains: ['imdb.com'],
            exclude_domains: ['example.com'],
            is_active: true
          }]
        };
      }
      if (typeof sql === 'string' && sql.startsWith('DELETE FROM tavily_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tavily_config')) {
        expect(params[0]).toBe('');
        return {
          rows: [{
            api_key: '',
            search_depth: 'basic',
            max_results: 9,
            include_domains: ['imdb.com'],
            exclude_domains: ['example.com'],
            is_active: true
          }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tavily')
      .send({ api_key: '' })
      .expect(200);

    expect(res.body.api_key).toBe('');
  });

  it('preserves OMDb active state, daily limit, and usage stats on partial masked updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM omdb_config LIMIT 1') {
        return {
          rows: [{
            api_key: 'stored-omdb-key',
            is_active: false,
            daily_limit: 750,
            requests_today: 32,
            last_reset_date: '2026-03-21'
          }]
        };
      }
      if (typeof sql === 'string' && sql.startsWith('DELETE FROM omdb_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO omdb_config')) {
        expect(params).toEqual(['stored-omdb-key', false, 750, 32, '2026-03-21']);
        return {
          rows: [{
            id: 1,
            api_key: 'stored-omdb-key',
            is_active: false,
            daily_limit: 750,
            requests_today: 32,
            last_reset_date: '2026-03-21'
          }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/omdb')
      .send({ api_key: '••••••••-masked' })
      .expect(200);

    expect(res.body.is_active).toBe(false);
    expect(res.body.daily_limit).toBe(750);
    expect(res.body.requests_today).toBe(32);
    expect(schedulerService.runGapAnalysis).not.toHaveBeenCalled();
  });

  it('clears OMDb API key when empty string is submitted', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM omdb_config LIMIT 1') {
        return {
          rows: [{
            api_key: 'stored-omdb-key',
            is_active: false,
            daily_limit: 750,
            requests_today: 32,
            last_reset_date: '2026-03-21'
          }]
        };
      }
      if (typeof sql === 'string' && sql.startsWith('DELETE FROM omdb_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO omdb_config')) {
        expect(params).toEqual(['', false, 750, 32, '2026-03-21']);
        return {
          rows: [{
            id: 1,
            api_key: '',
            is_active: false,
            daily_limit: 750,
            requests_today: 32,
            last_reset_date: '2026-03-21'
          }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/omdb')
      .send({ api_key: '' })
      .expect(200);

    expect(res.body.api_key).toBe('');
  });

  it('uses the stored active OMDb key for /settings/omdb/search', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'stored-omdb-key' }]
    });
    omdbService.getByTitle.mockResolvedValueOnce({ Title: 'Blade Runner' });

    const res = await request(app)
      .post('/settings/omdb/search')
      .send({ title: 'Blade Runner', year: '1982', type: 'movie' })
      .expect(200);

    expect(omdbService.getByTitle).toHaveBeenCalledWith('Blade Runner', '1982', 'movie', 'stored-omdb-key');
    expect(res.body).toEqual({ Title: 'Blade Runner' });
  });

  it('still uses the stored Tavily API key for /settings/tavily/search when the request is masked', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ api_key: 'live-tavily-key' }] })
      .mockResolvedValueOnce({
        rows: [{
          search_depth: 'advanced',
          max_results: 7,
          include_domains: ['imdb.com', 'rottentomatoes.com'],
          exclude_domains: ['example.com']
        }]
      });
    tavilyService.search.mockResolvedValueOnce({ results: [] });

    const res = await request(app)
      .post('/settings/tavily/search')
      .send({
        query: 'blade runner parental guide',
        api_key: '••••••••-masked'
      })
      .expect(200);

    expect(tavilyService.search).toHaveBeenCalledWith('blade runner parental guide', {
      apiKey: 'live-tavily-key',
      searchDepth: 'advanced',
      maxResults: 7,
      includeDomains: ['imdb.com', 'rottentomatoes.com'],
      excludeDomains: ['example.com']
    });
    expect(res.body).toEqual({ results: [] });
  });

  it('returns 500 from GET /settings/tmdb when config lookup fails', async () => {
    db.query.mockRejectedValueOnce(new Error('tmdb lookup failed'));

    const res = await request(app).get('/settings/tmdb');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'tmdb lookup failed' });
  });

  it('rolls back failed TMDB config updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tmdb_config WHERE is_active = true LIMIT 1') {
        return { rows: [{ api_key: 'stored-tmdb-key', language: 'en-US' }] };
      }
      if (typeof sql === 'string' && sql.startsWith('UPDATE tmdb_config SET is_active = false')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tmdb_config')) {
        throw new Error('insert failed');
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tmdb')
      .send({ api_key: 'live-key', language: 'fr-FR' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'insert failed' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rejects /settings/tmdb/test when no request or stored API key exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/tmdb/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'API key is required' });
    expect(tmdbService.testConnection).not.toHaveBeenCalled();
  });

  it('returns unavailable TMDB health when no active config exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/tmdb/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'unavailable',
      configured: false,
      ssl_valid: null,
      api_reachable: null,
      message: 'TMDB API not configured'
    });
  });

  it('returns degraded TMDB health when SSL is failing but the API is reachable', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'stored-tmdb-key', is_active: true }] });
    tmdbService.checkHealth.mockResolvedValueOnce({
      healthy: false,
      ssl_error: true,
      api_reachable: true,
      message: 'certificate mismatch'
    });

    const res = await request(app).get('/settings/tmdb/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'degraded',
      configured: true,
      ssl_valid: false,
      api_reachable: true,
      message: 'certificate mismatch'
    });
  });

  it('returns 500 from GET /settings/tavily when config lookup fails', async () => {
    db.query.mockRejectedValueOnce(new Error('tavily lookup failed'));

    const res = await request(app).get('/settings/tavily');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'tavily lookup failed' });
  });

  it('rejects /settings/tavily/search when query or API key is missing', async () => {
    const res = await request(app)
      .post('/settings/tavily/search')
      .send({ query: '' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'API key and query are required' });
    expect(tavilyService.search).not.toHaveBeenCalled();
  });

  it('returns unavailable Tavily health when no active config exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/tavily/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'unavailable',
      configured: false,
      ssl_valid: null,
      api_reachable: null,
      message: 'Tavily API not configured'
    });
  });

  it('rolls back failed Tavily config updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM tavily_config LIMIT 1') {
        return { rows: [{ api_key: 'stored-tavily-key', max_results: 8 }] };
      }
      if (typeof sql === 'string' && sql.startsWith('DELETE FROM tavily_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO tavily_config')) {
        throw new Error('tavily insert failed');
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/tavily')
      .send({ api_key: 'live-key', max_results: 9 });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'tavily insert failed' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns 500 from /settings/tavily/test when the provider probe fails', async () => {
    tavilyService.testConnection.mockRejectedValueOnce(new Error('probe failed'));

    const res = await request(app)
      .post('/settings/tavily/test')
      .send({ api_key: 'live-tavily-key' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'probe failed' });
  });

  it('returns 500 from /settings/tavily/search when Tavily search throws', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ search_depth: 'basic', max_results: 3, include_domains: [], exclude_domains: [] }]
    });
    tavilyService.search.mockRejectedValueOnce(new Error('search failed'));

    const res = await request(app)
      .post('/settings/tavily/search')
      .send({ query: 'test query', api_key: 'live-tavily-key' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'search failed' });
  });

  it('returns 500 from /settings/tavily/health when the health check throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'stored-tavily-key', is_active: true }] });
    tavilyService.checkHealth.mockRejectedValueOnce(new Error('health failed'));

    const res = await request(app).get('/settings/tavily/health');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      status: 'unavailable',
      configured: null,
      ssl_valid: null,
      api_reachable: false,
      message: 'health failed'
    });
  });

  it('returns 500 from GET /settings/omdb when config lookup fails', async () => {
    db.query.mockRejectedValueOnce(new Error('omdb lookup failed'));

    const res = await request(app).get('/settings/omdb');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'omdb lookup failed' });
  });

  it('rejects /settings/omdb/test when no request or stored API key exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/omdb/test')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'API key is required' });
    expect(omdbService.testConnection).not.toHaveBeenCalled();
  });

  it('returns 500 from /settings/omdb/test when the provider probe fails', async () => {
    omdbService.testConnection.mockRejectedValueOnce(new Error('probe failed'));

    const res = await request(app)
      .post('/settings/omdb/test')
      .send({ api_key: 'live-omdb-key' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'probe failed' });
  });

  it('rejects /settings/omdb/search when OMDb is not configured', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/omdb/search')
      .send({ title: 'Blade Runner' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'OMDb not configured' });
    expect(omdbService.getByTitle).not.toHaveBeenCalled();
  });

  it('returns 500 from /settings/omdb/search when OMDb lookup throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'stored-omdb-key' }] });
    omdbService.getByTitle.mockRejectedValueOnce(new Error('lookup failed'));

    const res = await request(app)
      .post('/settings/omdb/search')
      .send({ title: 'Blade Runner' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'lookup failed' });
  });

  it('returns unavailable OMDb health when no active config exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/omdb/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'unavailable',
      configured: false,
      ssl_valid: null,
      api_reachable: null,
      message: 'OMDb API not configured'
    });
  });

  it('returns 500 from /settings/omdb/health when the health check throws', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ api_key: 'stored-omdb-key', is_active: true }] });
    omdbService.checkHealth.mockRejectedValueOnce(new Error('health failed'));

    const res = await request(app).get('/settings/omdb/health');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      status: 'unavailable',
      configured: null,
      ssl_valid: null,
      api_reachable: false,
      message: 'health failed'
    });
  });
});
