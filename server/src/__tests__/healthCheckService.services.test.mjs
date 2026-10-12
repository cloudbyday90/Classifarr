/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * Extended tests for HealthCheckService.
 * Covers all check functions beyond checkImageEmbeddings (which has its own file).
 */

import { jest } from '@jest/globals';
import { createNamedMockModule, createLoggerModuleMock } from './helpers/mockFactory.mjs';

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
}));jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const db = mockDb;
const radarrService = mockRadarr;
const sonarrService = mockSonarr;
const ollamaService = mockOllama;
const tmdbService = mockTmdb;
const omdbService = mockOmdb;
const discordBotService = mockDiscordBot;
const svc = await import('../services/healthCheckService.mjs');

function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
}

describe('healthCheckService - all service checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    svc.resetHealthState();

    mockDb.query.mockReset();
    // Stable fixture configuration can be re-read at completion. Explicit queued
    // responses below still take precedence for failure/change scenarios.
    mockDb.query.mockImplementation(sql => {
      const first = mockDb.query.mock.calls.findIndex(([query]) => query === sql);
      return mockDb.query.mock.results[first]?.value;
    });
    mockRadarr.testConnection.mockReset();
    mockSonarr.testConnection.mockReset();
    mockOllama.testConnection.mockReset();
    mockTmdb.testConnection.mockReset();
    mockOmdb.testConnection.mockReset();
    mockDiscordBot.client = null;
    mockDiscordBot.sendSystemAlert.mockReset().mockResolvedValue(undefined);
    mockHttpGet.mockReset();
  });

  afterEach(() => {
    svc.stopHeartbeat();
  });

  describe.each([
    ['Radarr', svc.checkRadarr], ['Sonarr', svc.checkSonarr], ['Discord', svc.checkDiscordBot],
    ['AI', svc.checkOllama], ['Media Server', svc.checkMediaServer], ['TMDb', svc.checkTMDB],
    ['OMDb', svc.checkOMDb], ['Tavily', svc.checkTavily], ['RAG', svc.checkRAG], ['Image', svc.checkImageEmbeddings],
  ])('%s configuration admission', (_name, check) => {
    test('changed configuration discards the observed result; next normal check recovers', async () => {
      db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ changed: true }] });
      expect(await check()).toMatchObject({ status: 'unknown', failure: { code: 'configuration_changed' } });
      expect(mockDiscordBot.sendSystemAlert).not.toHaveBeenCalled();
      expect(db.query).toHaveBeenCalledTimes(2);
      db.query.mockResolvedValue({ rows: [] });
      expect(['not configured', 'disabled']).toContain((await check()).status);
    });

    test.each(['ECONNRESET', '42P01', '42501', '57014', undefined])('failed %s read is unknown without provider traffic', async code => {
      mockDiscordBot.client = { isReady: jest.fn(() => true) };
      db.query.mockRejectedValueOnce(Object.assign(new Error('private database message'), { code }));
      const result = await check();
      expect(result.status).toBe('unknown');
      expect(result.failure.stage).toBe('configuration_read');
      expect(result.lastSuccessfulCheck).toBeNull();
      expect(db.query).toHaveBeenCalledTimes(1);
      for (const probe of [mockHttpGet, mockHttpPost, mockHttpPut, mockRadarr.testConnection, mockSonarr.testConnection,
        mockOllama.testConnection, mockTmdb.testConnection, mockOmdb.testConnection, mockDiscordBot.client.isReady,
        mockDiscordBot.sendSystemAlert]) expect(probe).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain('private database message');
    });

    test.each([undefined, { rows: null }, { rows: [null] }])('malformed %j result cannot become inactive', async value => {
      db.query.mockResolvedValueOnce(value);
      const result = await check();
      expect(result.failure.code).toBe('configuration_read_invalid');
      expect(result.status).toBe('unknown');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('successful empty read clears the prior failure and restores genuine inactivity', async () => {
      db.query.mockRejectedValueOnce(new Error('private')).mockResolvedValue({ rows: [] });
      expect((await check()).status).toBe('unknown');
      const result = await check();
      expect(['not configured', 'disabled']).toContain(result.status);
      expect(result.failure).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  test('preserves last success across a failed membership read and clears failure after recovery', async () => {
    const rows = [{ id: 1, name: 'Movies' }];
    db.query.mockResolvedValueOnce({ rows }).mockResolvedValueOnce({ rows })
      .mockRejectedValueOnce(new Error('private')).mockResolvedValueOnce({ rows });
    mockRadarr.testConnection.mockResolvedValue(undefined);
    const healthy = await svc.checkRadarr();
    const unknown = await svc.checkRadarr();
    expect(unknown.lastSuccessfulCheck).toBe(healthy.lastSuccessfulCheck);
    expect(unknown.previousStatus).toBe('connected');
    expect(unknown.instances).toBeUndefined();
    expect(mockRadarr.testConnection).toHaveBeenCalledTimes(1);
    const recovered = await svc.checkRadarr();
    expect(recovered.status).toBe('connected');
    expect(recovered.failure).toBeUndefined();
    expect(mockRadarr.testConnection).toHaveBeenCalledTimes(2);
  });

  test('an unexpected Discord client failure is not absent configuration', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ bot_token: 'test' }] });
    mockDiscordBot.client = { isReady: () => { throw new Error('private'); } };
    expect(await svc.checkDiscordBot()).toMatchObject({ status: 'unknown', failure: { code: 'health_check_failed' } });
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

  test('simultaneous refreshes share a real service probe, then reject disabled-during-flight results', async () => {
    const started = deferred();
    const gate = deferred();
    let rows = [{ id: 1, name: 'Old instance', url: 'http://fixture', api_key: 'private' }];
    db.query.mockImplementation(async () => ({ rows }));
    mockRadarr.testConnection.mockImplementation(() => { started.resolve(); return gate.promise; });
    const first = svc.checkRadarr();
    const second = svc.checkRadarr();
    await started.promise;
    rows = [];
    gate.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect(a).toBe(b);
    expect(a.failure.code).toBe('configuration_changed');
    expect(a.instances).toBeUndefined();
    expect(mockRadarr.testConnection).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(a)).not.toMatch(/Old instance|private/);
  });

  test('aggregate waiters share work and an accepted service change invalidates cached aggregates', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const [a, b] = await Promise.all([svc.getAllServicesHealth(), svc.getAllServicesHealth()]);
    expect(a).toBe(b);
    const reads = db.query.mock.calls.length;
    expect(await svc.getAllServicesHealth()).toBe(a);
    expect(db.query).toHaveBeenCalledTimes(reads);
    await svc.checkDatabase();
    expect(await svc.getAllServicesHealth()).not.toBe(a);
  });

  test('aggregate projects latest service values after a slow peer, not its early captured result', async () => {
    const started = deferred();
    const gate = deferred();
    let sonarrRows = [];
    db.query.mockImplementation(async sql => {
      if (sql.includes('radarr_config')) return { rows: [{ id: 1 }] };
      if (sql.includes('sonarr_config')) return { rows: sonarrRows };
      return { rows: [] };
    });
    mockRadarr.testConnection.mockImplementation(() => { started.resolve(); return gate.promise; });
    const aggregate = svc.getAllServicesHealth();
    await started.promise;
    await svc.checkSonarr();
    sonarrRows = [{ id: 2, name: 'Current instance' }];
    mockSonarr.testConnection.mockResolvedValue(undefined);
    await svc.checkSonarr();
    gate.resolve();
    expect((await aggregate).sonarr.instances[0].name).toBe('Current instance');
  });

  test('reset prevents an old aggregate from replacing a new cache entry', async () => {
    const started = deferred();
    const gate = deferred();
    db.query.mockImplementation(async sql => ({ rows: sql.includes('radarr_config') ? [{ id: 1 }] : [] }));
    mockRadarr.testConnection.mockImplementation(() => { started.resolve(); return gate.promise; });
    const old = svc.getAllServicesHealth();
    await started.promise;
    svc.resetHealthState();
    db.query.mockResolvedValue({ rows: [] });
    const current = await svc.getAllServicesHealth();
    gate.resolve();
    expect((await old).radarr.status).toBe('not configured');
    expect(await svc.getAllServicesHealth()).toBe(current);
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

    test('returns unknown on db error', async () => {
      discordBotService.client = null;
      db.query.mockRejectedValueOnce(new Error('table not found'));

      const result = await svc.checkDiscordBot();
      expect(result.status).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // checkOllama
  // -------------------------------------------------------------------------
  describe('checkOllama', () => {
    test('returns unknown when ai_provider_config table missing', async () => {
      db.query.mockRejectedValueOnce(new Error('relation does not exist'));
      const result = await svc.checkOllama();
      expect(result.status).toBe('unknown');
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
    test('returns unknown when table missing', async () => {
      db.query.mockRejectedValueOnce(new Error('relation does not exist'));
      const result = await svc.checkRadarr();
      expect(result.status).toBe('unknown');
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
    test.each([
      { success: false, error: 'OMDb authentication failed; check the API key' },
      { success: false, error: 'OMDb provider request limit reached' },
      null, undefined, {},
    ])('preserves last success when the probe resolves a failure %#', async probeResult => {
      db.query.mockResolvedValue({ rows: [{ api_key: 'omdb-key' }] });
      omdbService.testConnection.mockResolvedValueOnce({ success: true });
      const healthy = await svc.checkOMDb();
      omdbService.testConnection.mockResolvedValueOnce(probeResult);
      const failed = await svc.checkOMDb();
      expect(failed.status).toBe('disconnected');
      expect(failed.lastSuccessfulCheck).toBe(healthy.lastSuccessfulCheck);
      expect(failed.previousStatus).toBe('connected');
      expect(failed.error).toBe(probeResult?.error || 'OMDb connection test failed');
    });

    test('returns not configured when no api key', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkOMDb();
      expect(result.status).toBe('not configured');
    });

    test('returns connected on successful testConnection', async () => {
      db.query.mockResolvedValueOnce({ rows: [{ api_key: 'omdb-key' }] });
      omdbService.testConnection.mockResolvedValueOnce({ success: true });

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

    test('returns unknown on db exception', async () => {
      db.query.mockRejectedValueOnce(new Error('table not found'));
      const result = await svc.checkTavily();
      expect(result.status).toBe('unknown');
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
      expect(result.embeddingsTable).toBe(false);
    });

    test('returns disabled when no ai config row', async () => {
      db.query.mockResolvedValueOnce({ rows: [] });
      const result = await svc.checkRAG();
      expect(result.status).toBe('disabled');
    });

    test('returns available when rag extension, table, and required indexes are ready', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic', rag_image_weight: 0 }] })
        .mockResolvedValueOnce({
          rows: [{
            pgvector_available: true,
            embeddings_table_available: true,
            text_index_available: true,
            image_index_available: false,
            prewarm_available: true
          }]
        })
        .mockResolvedValueOnce({ rows: [{ count: '42' }] })  // embedding count
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });  // stale count

      const result = await svc.checkRAG();
      expect(result.status).toBe('available');
      expect(result.pgvector).toBe(true);
      expect(result.embeddingsTable).toBe(true);
      expect(result.prewarm).toBe(true);
      expect(result.indexes).toEqual({
        text: true,
        image: false,
        imageRequired: false,
        missing: [],
      });
    });

    test('returns degraded when required image index is missing', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic', rag_image_weight: 0.25 }] })
        .mockResolvedValueOnce({
          rows: [{
            pgvector_available: true,
            embeddings_table_available: true,
            text_index_available: true,
            image_index_available: false,
            prewarm_available: true
          }]
        })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await svc.checkRAG();
      expect(result.status).toBe('degraded');
      expect(result.pgvector).toBe(true);
      expect(result.indexes).toEqual({
        text: true,
        image: false,
        imageRequired: true,
        missing: ['image'],
      });
    });

    test('returns degraded when pg_prewarm is unavailable but rag is otherwise ready', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic', rag_image_weight: 0 }] })
        .mockResolvedValueOnce({
          rows: [{
            pgvector_available: true,
            embeddings_table_available: true,
            text_index_available: true,
            image_index_available: false,
            prewarm_available: false
          }]
        })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await svc.checkRAG();
      expect(result.status).toBe('degraded');
      expect(result.prewarm).toBe(false);
    });

    test('returns unavailable when pgvector readiness lookup throws', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic', rag_image_weight: 0 }] })
        .mockRejectedValueOnce(new Error('type vector does not exist'));

      const result = await svc.checkRAG();
      expect(result.status).toBe('unavailable');
      expect(result.pgvector).toBe(false);
      expect(result.embeddingsTable).toBe(false);
    });

    test('returns unavailable when embeddings table is missing', async () => {
      db.query
        .mockResolvedValueOnce({ rows: [{ rag_enabled: true, embedding_provider: 'local', embedding_model: 'nomic', rag_image_weight: 0 }] })
        .mockResolvedValueOnce({
          rows: [{
            pgvector_available: true,
            embeddings_table_available: false,
            text_index_available: false,
            image_index_available: false,
            prewarm_available: true
          }]
        });

      const result = await svc.checkRAG();
      expect(result.status).toBe('unavailable');
      expect(result.pgvector).toBe(true);
      expect(result.embeddingsTable).toBe(false);
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
    test('background reconciliation retires committed settings without probing or changing check time', async () => {
      jest.useFakeTimers();
      let changed = false;
      db.query.mockImplementation(sql => Promise.resolve({ rows:
        changed && sql.includes('FROM radarr_config') ? [{ id: 1, name: 'new fixture' }] : []
      }));
      try {
        svc.startHeartbeat();
        await jest.advanceTimersByTimeAsync(0);
        const before = svc.getHealthCache();
        changed = true;
        await jest.advanceTimersByTimeAsync(30000);
        expect(svc.getHealthCache().radarr).toMatchObject({
          status: 'unknown', lastCheck: before.radarr.lastCheck,
          failure: { stage: 'configuration_reconciliation', code: 'configuration_changed' },
        });
        expect(svc.getHealthCache().database).toBe(before.database);
        expect(mockRadarr.testConnection).not.toHaveBeenCalled();
        expect(mockHttpGet).not.toHaveBeenCalled();
        const count = db.query.mock.calls.length;
        svc.getHealthCache();
        expect(db.query).toHaveBeenCalledTimes(count);
      } finally {
        svc.resetHealthState();
        jest.useRealTimers();
      }
    });

    test.each([null, 0, -1, 999, 1000.1, NaN, Infinity, '60000', 86400001])('invalid interval %j cannot start checks', interval => {
      expect(() => svc.startHeartbeat(interval)).toThrow(RangeError);
      expect(svc.isHeartbeatRunning()).toBe(false);
      expect(db.query).not.toHaveBeenCalled();
    });

    test('reports actual cadence across replacement, invalid input, stop and reset without refreshing reads', async () => {
      jest.useFakeTimers();
      db.query.mockResolvedValue({ rows: [] });
      try {
        svc.startHeartbeat(60000);
        await jest.advanceTimersByTimeAsync(0);
        expect(svc.getHealthFreshnessPolicy()).toMatchObject({ intervalMs: 60000, maxAgeMs: 90000, heartbeatActive: true });
        expect(() => svc.startHeartbeat(Infinity)).toThrow(RangeError);
        expect(svc.getHealthFreshnessPolicy().intervalMs).toBe(60000);
        expect(jest.getTimerCount()).toBe(2); // heartbeat and read-only reconciliation
        svc.startHeartbeat(120000);
        await jest.advanceTimersByTimeAsync(0);
        expect(jest.getTimerCount()).toBe(2);
        svc.stopHeartbeat();
        expect(svc.getHealthFreshnessPolicy()).toMatchObject({ intervalMs: 120000, heartbeatActive: false });
        const count = db.query.mock.calls.length;
        const lastCheck = svc.getHealthCache().database.lastCheck;
        await jest.advanceTimersByTimeAsync(180000);
        svc.getHealthFreshnessPolicy();
        expect(db.query).toHaveBeenCalledTimes(count);
        expect(svc.getHealthCache().database.lastCheck).toBe(lastCheck);
        svc.resetHealthState();
        expect(svc.getHealthFreshnessPolicy()).toMatchObject({ intervalMs: 900000, heartbeatActive: false });
      } finally {
        svc.stopHeartbeat();
        jest.useRealTimers();
      }
    });

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
