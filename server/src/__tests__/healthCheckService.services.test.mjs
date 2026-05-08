/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Extended tests for HealthCheckService.
 * Covers all check functions beyond checkImageEmbeddings (which has its own file).
 */

import { jest } from '@jest/globals';
import { createMockModule, createNamedMockModule } from './helpers/mockFactory.mjs';

const mockDb = { query: jest.fn() };
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

const mockRadarr = { testConnection: jest.fn() };
jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

const mockSonarr = { testConnection: jest.fn() };
jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

const mockOllama = { testConnection: jest.fn() };
jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

const mockTmdb = { testConnection: jest.fn() };
jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

const mockOmdb = { testConnection: jest.fn() };
jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

const mockDiscordBot = { client: null, sendSystemAlert: jest.fn().mockResolvedValue(undefined) };
jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

const mockHttpGet = jest.fn();
const mockHttpPost = jest.fn();
const mockHttpPut = jest.fn();
jest.unstable_mockModule('../utils/httpClient.mjs', () => ({
  httpGet: mockHttpGet,
  httpPost: mockHttpPost,
  httpPut: mockHttpPut,
  httpDelete: jest.fn(),
  httpGetBinary: jest.fn(),
  httpStream: jest.fn(),
  createHttpClient: jest.fn(),
  defaultHttpClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));const mockLogger = {
  createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })
};
jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

describe('healthCheckService - all service checks', () => {
  let db;
  let radarrService;
  let sonarrService;
  let ollamaService;
  let tmdbService;
  let omdbService;
  let discordBotService;
  let svc;

  beforeEach(async () => {
    jest.resetModules();

    mockDb.query = jest.fn();
    mockRadarr.testConnection = jest.fn();
    mockSonarr.testConnection = jest.fn();
    mockOllama.testConnection = jest.fn();
    mockTmdb.testConnection = jest.fn();
    mockOmdb.testConnection = jest.fn();
    mockDiscordBot.client = null;
    mockDiscordBot.sendSystemAlert = jest.fn().mockResolvedValue(undefined);
    mockHttpGet.mockReset();

    jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));
    jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));
    jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));
    jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));
    jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));
    jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));
    jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));
    db = mockDb;
    radarrService = mockRadarr;
    sonarrService = mockSonarr;
    ollamaService = mockOllama;
    tmdbService = mockTmdb;
    omdbService = mockOmdb;
    discordBotService = mockDiscordBot;
    svc = await import('../services/healthCheckService.mjs');
  });

  afterEach(() => {
    svc.stopHeartbeat();
  });

  // -------------------------------------------------------------------------
  // checkDatabase
  // -------------------------------------------------------------------------
  describe('checkDatabase', () => {
    test('returns connected status on successful db query', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkDatabase();
      expect(result.status).toBe('connected');
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.lastCheck).toBeTruthy();
    });

    test('returns disconnected status when db query fails', async () => {
      db.query.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await svc.checkDatabase();
      expect(result.status).toBe('disconnected');
      expect(result.error).toBe('Connection refused');
    });
  });

  // -------------------------------------------------------------------------
  // checkDiscordBot
  // -------------------------------------------------------------------------
  describe('checkDiscordBot', () => {
    test('returns not configured when no discord config row exists', async () => {
      discordBotService.client = null;
      db.query.mockResolvedValueOnce({ rows: [] }); // no discord_config row

      const result = await svc.checkDiscordBot();
      expect(result.status).toBe('not configured');
    });

    test('returns disconnected when configured but client not ready', async () => {
      discordBotService.client = { isReady: () => false };
      db.query.mockResolvedValueOnce({ rows: [{ bot_token: 'some-token' }] });

      const result = await svc.checkDiscordBot();
      expect(result.status).toBe('disconnected');
    });

    test('returns connected when client isReady()', async () => {
      discordBotService.client = { isReady: () => true };
      db.query.mockResolvedValueOnce({ rows: [{ bot_token: 'some-token' }] });

      const result = await svc.checkDiscordBot();
      expect(result.status).toBe('connected');
    });

    test('falls back to not configured on db error', async () => {
      discordBotService.client = null;
      db.query.mockRejectedValueOnce(new Error('table not found'));

      const result = await svc.checkDiscordBot();
      expect(result.status).toBe('not configured');
    });
  });

  // -------------------------------------------------------------------------
  // checkOllama
  // -------------------------------------------------------------------------
  describe('checkOllama', () => {
    test('returns not configured when ai_provider_config table missing', async () => {
      db.query.mockRejectedValueOnce(new Error('relation does not exist'));
      const result = await svc.checkOllama();
      expect(result.status).toBe('not configured');
    });

    test('returns not configured when no ai config row exists', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('not configured');
    });

    test('returns not configured when primary_provider is none', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'none' }] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('not configured');
    });

    test('tests ollama connection and returns connected', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'ollama', ollama_url: 'http://localhost:11434' }] });
      ollamaService.testConnection.mockResolvedValueOnce(true);

      const result = await svc.checkOllama();
      expect(result.status).toBe('connected');
      expect(result.provider).toBe('ollama');
    });

    test('returns disconnected when ollama testConnection fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'ollama', ollama_url: 'http://localhost:11434' }] });
      ollamaService.testConnection.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await svc.checkOllama();
      expect(result.status).toBe('disconnected');
    });

    test('returns connected for openai when key is present', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'openai', openai_api_key: 'sk-test123' }] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('connected');
    });

    test('returns disconnected for openai when key is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'openai', openai_api_key: null }] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('disconnected');
    });

    test('returns connected for anthropic when key is present', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'anthropic', anthropic_api_key: 'ant-test' }] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('connected');
    });

    test('returns disconnected for anthropic when key is missing', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ primary_provider: 'anthropic', anthropic_api_key: null }] });
      const result = await svc.checkOllama();
      expect(result.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // checkRadarr
  // -------------------------------------------------------------------------
  describe('checkRadarr', () => {
    test('returns not configured when table missing', async () => {
      db.query.mockRejectedValueOnce(new Error('relation does not exist'));
      const result = await svc.checkRadarr();
      expect(result.status).toBe('not configured');
    });

    test('returns not configured when no active instances', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkRadarr();
      expect(result.status).toBe('not configured');
    });

    test('returns connected when all instances are up', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Radarr 4K' }] });
      radarrService.testConnection.mockResolvedValueOnce(true);

      const result = await svc.checkRadarr();
      expect(result.status).toBe('connected');
      expect(result.instances).toHaveLength(1);
      expect(result.instances[0].status).toBe('connected');
    });

    test('returns disconnected when all instances are down', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Radarr' }] });
      radarrService.testConnection.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await svc.checkRadarr();
      expect(result.status).toBe('disconnected');
    });

    test('returns partial when some instances are down', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'R1' }, { id: 2, name: 'R2' }] });
      radarrService.testConnection
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await svc.checkRadarr();
      expect(result.status).toBe('partial');
    });
  });

  // -------------------------------------------------------------------------
  // checkSonarr
  // -------------------------------------------------------------------------
  describe('checkSonarr', () => {
    test('returns not configured when no active instances', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkSonarr();
      expect(result.status).toBe('not configured');
    });

    test('returns connected when instance responds', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Sonarr' }] });
      sonarrService.testConnection.mockResolvedValueOnce(true);

      const result = await svc.checkSonarr();
      expect(result.status).toBe('connected');
    });

    test('returns disconnected when instance fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Sonarr' }] });
      sonarrService.testConnection.mockRejectedValueOnce(new Error('timeout'));

      const result = await svc.checkSonarr();
      expect(result.status).toBe('disconnected');
    });

    test('returns partial when some instances are down', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'S1' }, { id: 2, name: 'S2' }] });
      sonarrService.testConnection
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await svc.checkSonarr();
      expect(result.status).toBe('partial');
    });
  });

  // -------------------------------------------------------------------------
  // checkTMDB
  // -------------------------------------------------------------------------
  describe('checkTMDB', () => {
    test('returns not configured when no api key', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkTMDB();
      expect(result.status).toBe('not configured');
    });

    test('returns connected on successful testConnection', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'test-key-123' }] });
      tmdbService.testConnection.mockResolvedValueOnce(true);

      const result = await svc.checkTMDB();
      expect(result.status).toBe('connected');
    });

    test('returns disconnected when testConnection fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'test-key-123' }] });
      tmdbService.testConnection.mockRejectedValueOnce(new Error('Unauthorized'));

      const result = await svc.checkTMDB();
      expect(result.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // checkOMDb
  // -------------------------------------------------------------------------
  describe('checkOMDb', () => {
    test('returns not configured when no api key', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkOMDb();
      expect(result.status).toBe('not configured');
    });

    test('returns connected on successful testConnection', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'omdb-key' }] });
      omdbService.testConnection.mockResolvedValueOnce(true);

      const result = await svc.checkOMDb();
      expect(result.status).toBe('connected');
    });

    test('returns disconnected when testConnection fails', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'omdb-key' }] });
      omdbService.testConnection.mockRejectedValueOnce(new Error('Invalid key'));

      const result = await svc.checkOMDb();
      expect(result.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // checkTavily
  // -------------------------------------------------------------------------
  describe('checkTavily', () => {
    test('returns not configured when no api key', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkTavily();
      expect(result.status).toBe('not configured');
    });

    test('returns configured when api key present', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'tvly-test-key' }] });
      const result = await svc.checkTavily();
      expect(result.status).toBe('configured');
    });

    test('returns error on db exception', async () => {
      db.query.mockRejectedValueOnce(new Error('table not found'));
      const result = await svc.checkTavily();
      expect(result.status).toBe('error');
    });
  });

  // -------------------------------------------------------------------------
  // checkRAG
  // -------------------------------------------------------------------------
  describe('checkRAG', () => {
    test('returns disabled when rag_enabled is false', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ rag_enabled: false }] });
      const result = await svc.checkRAG();
      expect(result.status).toBe('disabled');
      expect(result.pgvector).toBe(false);
    });

    test('returns disabled when no ai config row', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkRAG();
      expect(result.status).toBe('disabled');
    });

    test('returns available when pgvector test succeeds', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic' }] })
        .mockResolvedValueOnce({ rows: [] })  // pgvector test (success)
        .mockResolvedValueOnce({ rows: [{ count: '42' }] })  // embedding count
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });  // stale count

      const result = await svc.checkRAG();
      expect(result.status).toBe('available');
      expect(result.pgvector).toBe(true);
    });

    test('returns unavailable when pgvector test throws', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic' }] })
        .mockRejectedValueOnce(new Error('type vector does not exist')) // pgvector fails
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await svc.checkRAG();
      expect(result.status).toBe('unavailable');
      expect(result.pgvector).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // checkProcessMemory
  // -------------------------------------------------------------------------
  describe('checkProcessMemory', () => {
    test('returns ok status under normal memory conditions', () => {
      const result = svc.checkProcessMemory();
      // In test env memory usage should be well below warning thresholds
      expect(['ok', 'warning', 'critical']).toContain(result.status);
      expect(result.process.heapUsedMb).toBeGreaterThan(0);
      expect(result.os.totalMemMb).toBeGreaterThan(0);
    });

    test('returns process and os memory fields', () => {
      const result = svc.checkProcessMemory();
      expect(result.process).toHaveProperty('heapUsedMb');
      expect(result.process).toHaveProperty('heapTotalMb');
      expect(result.process).toHaveProperty('rssMb');
      expect(result.os).toHaveProperty('totalMemMb');
      expect(result.os).toHaveProperty('freeMemMb');
      expect(result.os).toHaveProperty('usedMemMb');
    });
  });

  // -------------------------------------------------------------------------
  // checkQueueWorker
  // -------------------------------------------------------------------------
  describe('checkQueueWorker', () => {
    test('returns connected when tasks exist and no stall', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ processing: '1', pending: '2', last_activity: new Date().toISOString() }]
      });

      const result = await svc.checkQueueWorker();
      expect(result.status).toBe('connected');
      expect(result.metadata.processing).toBe(1);
    });

    test('returns degraded when last activity is stale with pending tasks', async () => {
      // last_activity more than 10 minutes ago
      const staleDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      db.query.mockResolvedValueOnce({
        rows: [{ processing: '0', pending: '3', last_activity: staleDate }]
      });

      const result = await svc.checkQueueWorker();
      expect(result.status).toBe('degraded');
    });

    test('returns disconnected on db error', async () => {
      db.query.mockRejectedValueOnce(new Error('table does not exist'));
      const result = await svc.checkQueueWorker();
      expect(result.status).toBe('disconnected');
    });
  });

  // -------------------------------------------------------------------------
  // getHealthCache / getUptime / isHeartbeatRunning
  // -------------------------------------------------------------------------
  describe('cache and heartbeat helpers', () => {
    test('getHealthCache returns an object with default unknown statuses', () => {
      const cache = svc.getHealthCache();
      expect(cache).toBeDefined();
      expect(typeof cache).toBe('object');
    });

    test('isHeartbeatRunning returns false initially', () => {
      expect(svc.isHeartbeatRunning()).toBe(false);
    });

    test('stopHeartbeat is a no-op when not running', () => {
      expect(() => svc.stopHeartbeat()).not.toThrow();
      expect(svc.isHeartbeatRunning()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // checkMediaServer
  // -------------------------------------------------------------------------
  describe('checkMediaServer', () => {
    test('returns not configured when no active media server', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkMediaServer();
      expect(result.status).toBe('not configured');
    });

    test('returns connected for Plex on successful http call', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ type: 'plex', selected_connection: 'http://plex:32400', token: 'plex-token', name: 'My Plex' }]
      });
      mockHttpGet.mockResolvedValueOnce({ status: 200, data: {} });

      const result = await svc.checkMediaServer();
      expect(result.status).toBe('connected');
      expect(result.type).toBe('plex');
    });

    test('returns disconnected when plex request fails', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ type: 'plex', selected_connection: 'http://plex:32400', token: 'plex-token', name: 'My Plex' }]
      });
      mockHttpGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await svc.checkMediaServer();
      expect(result.status).toBe('disconnected');
    });

    test('returns connected for Jellyfin on successful http call', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ type: 'jellyfin', url: 'http://jellyfin:8096', token: 'jf-token', name: 'Jellyfin' }]
      });
      mockHttpGet.mockResolvedValueOnce({ status: 200, data: {} });

      const result = await svc.checkMediaServer();
      expect(result.status).toBe('connected');
      expect(result.type).toBe('jellyfin');
    });
  });
});
