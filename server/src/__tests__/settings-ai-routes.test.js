/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const request = require('supertest');
const express = require('express');

jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({
  resetConfig: jest.fn()
}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/tavily', () => ({}));
jest.mock('../services/omdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/startupService', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/embeddingProvider', () => ({
  resetConfig: jest.fn()
}));
jest.mock('../services/embeddingRouter', () => ({
  resetConfig: jest.fn(),
  clearCache: jest.fn()
}));
jest.mock('../services/aiRouter', () => ({
  clearCache: jest.fn(),
  getStatus: jest.fn()
}));
jest.mock('../services/webhook', () => ({}));

jest.mock('../services/cloudLLM', () => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next()
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../utils/ragLoopConfig', () => ({
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
  validateIssue275PayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] }))
}));

jest.mock('../utils/encryption', () => ({
  encryptValue: jest.fn((v) => ({ encrypted: `enc_${v}`, iv: 'testiv', authTag: 'testtag' })),
  formatEncryptedValue: jest.fn((e, iv, at) => `${e}$${iv}$${at}`),
  parseEncryptedValue: jest.fn((v) => {
    const parts = v.split('$');
    return { encrypted: parts[0], iv: parts[1] || 'testiv', authTag: parts[2] || 'testtag' };
  }),
  decryptValue: jest.fn((e) => e.replace(/^enc_/, ''))
}));

const db = require('../config/database');
const cloudLLMService = require('../services/cloudLLM');
const ollamaService = require('../services/ollama');
const aiRouterService = require('../services/aiRouter');
const embeddingProvider = require('../services/embeddingProvider');
const embeddingRouter = require('../services/embeddingRouter');
const ragLoopConfig = require('../utils/ragLoopConfig');
const settingsRouter = require('../routes/settings');

describe('Settings AI Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('returns the full default AI config when no row exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/settings/ai');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      primary_provider: 'none',
      api_endpoint: '',
      api_key: '',
      model: '',
      temperature: 0.7,
      max_tokens: 2000,
      ollama_host: 'localhost',
      ollama_port: 11434,
      pattern_mining_enabled: true,
      embedding_provider_mode: 'same',
      image_embedding_provider_mode: 'disabled',
      rag_graph_enabled: false
    });
    expect(res.body.table_not_ready).toBeUndefined();
  });

  it('returns the same default AI config shape when the settings table is not ready', async () => {
    const tableMissing = new Error('relation "ai_provider_config" does not exist');
    tableMissing.code = '42P01';
    db.query.mockRejectedValueOnce(tableMissing);

    const res = await request(app).get('/settings/ai');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      primary_provider: 'none',
      api_endpoint: '',
      api_key: '',
      model: '',
      temperature: 0.7,
      max_tokens: 2000,
      ollama_host: 'localhost',
      ollama_port: 11434,
      pattern_mining_enabled: true,
      embedding_provider_mode: 'same',
      image_embedding_provider_mode: 'disabled',
      rag_graph_enabled: false,
      table_not_ready: true
    });
  });

  it('masks API keys in GET /settings/ai responses', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 1,
        primary_provider: 'openai',
        api_key: 'live-ai-key',
        embedding_cloud_api_key: 'live-embedding-key',
        image_embedding_cloud_api_key: 'live-image-key'
      }]
    });

    const res = await request(app).get('/settings/ai');

    expect(res.status).toBe(200);
    expect(res.body.primary_provider).toBe('openai');
    expect(res.body.api_key).toBeDefined();
    expect(res.body.api_key).not.toBe('live-ai-key');
    expect(res.body.embedding_cloud_api_key).toBeDefined();
    expect(res.body.embedding_cloud_api_key).not.toBe('live-embedding-key');
    expect(res.body.image_embedding_cloud_api_key).toBeDefined();
    expect(res.body.image_embedding_cloud_api_key).not.toBe('live-image-key');
  });

  it('preserves masked AI and embedding API keys on partial PUT /settings/ai updates', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    const existingConfig = {
      id: 1,
      primary_provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: 'stored-ai-key',
      model: 'gpt-5-mini',
      temperature: 0.7,
      max_tokens: 2000,
      monthly_budget_usd: null,
      budget_alert_threshold: 80,
      pause_on_budget_exhausted: true,
      ollama_fallback_enabled: false,
      ollama_for_basic_tasks: false,
      ollama_for_budget_exhausted: true,
      ollama_host: 'localhost',
      ollama_port: 11434,
      ollama_model: 'llama3.2',
      rag_enabled: false,
      embedding_provider: 'auto',
      embedding_model: '',
      rag_similarity_threshold: 0.70,
      rag_text_weight: 0.70,
      rag_image_weight: 0.30,
      rag_min_history_count: 50,
      rag_backfill_budget_type: 'percentage',
      rag_backfill_budget_value: 25,
      formula_pattern_weight: 0.40,
      formula_rule_weight: 0.30,
      formula_rag_weight: 0.20,
      formula_history_weight: 0.10,
      embedding_provider_mode: 'same',
      embedding_ollama_host: '',
      embedding_ollama_port: 11434,
      embedding_ollama_model: '',
      embedding_cloud_provider: 'openai',
      embedding_cloud_api_key: 'stored-embedding-key',
      embedding_cloud_model: 'text-embedding-3-small',
      image_embedding_provider_mode: 'cloud',
      image_embedding_local_host: '',
      image_embedding_local_port: 8000,
      image_embedding_local_model: '',
      image_embedding_cloud_provider: 'openai',
      image_embedding_cloud_api_key: 'stored-image-key',
      image_embedding_cloud_model: 'clip-large',
      image_embedding_cloud_api_endpoint: 'https://embeddings.example.test',
      image_embedding_image_size: 512,
      image_embedding_rps: 2,
      image_embedding_concurrency: 2,
      image_embedding_batch_size: 1,
      image_embedding_cache_ttl_hours: 24,
      image_embedding_cache_max_mb: 1024,
      rag_graph_enabled: false,
      rag_graph_weight: 0.20,
      rag_graph_collection_enabled: true,
      rag_graph_director_enabled: true,
      rag_graph_studio_enabled: false,
      rag_graph_cast_enabled: false,
      rag_graph_genre_enabled: false,
      rag_graph_min_matches_to_apply: 1,
      rag_graph_candidates_limit: 20
    };

    const updatedConfig = {
      ...existingConfig,
      model: 'gpt-5.2',
      image_embedding_provider_mode: 'separate_local'
    };

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
        return { rows: [existingConfig] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
        expect(params[2]).toBe('stored-ai-key');
        expect(params[33]).toBe('stored-embedding-key');
        expect(params[40]).toBe('stored-image-key');
        expect(params[35]).toBe('separate_local');
        return { rows: [] };
      }
      return { rows: [updatedConfig] };
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({
        model: 'gpt-5.2',
        api_key: '••••••••-masked',
        embedding_cloud_api_key: '••••••••-masked',
        image_embedding_cloud_api_key: '••••••••-masked',
        image_embedding_provider_mode: 'local'
      });

    expect(res.status).toBe(200);
    expect(aiRouterService.clearCache).toHaveBeenCalledTimes(1);
    expect(ollamaService.resetConfig).toHaveBeenCalledTimes(1);
    expect(embeddingProvider.resetConfig).toHaveBeenCalledTimes(1);
    expect(embeddingRouter.resetConfig).toHaveBeenCalledTimes(1);
    expect(res.body.api_key).toBeDefined();
    expect(res.body.api_key).not.toBe('stored-ai-key');
    expect(res.body.embedding_cloud_api_key).toBeDefined();
    expect(res.body.embedding_cloud_api_key).not.toBe('stored-embedding-key');
    expect(res.body.image_embedding_cloud_api_key).toBeDefined();
    expect(res.body.image_embedding_cloud_api_key).not.toBe('stored-image-key');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('uses the stored API key for /settings/ai/test when the request omits api_key', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'stored-live-key' }]
    });
    cloudLLMService.testConnection.mockResolvedValueOnce({ success: true, message: 'ok' });

    const res = await request(app)
      .post('/settings/ai/test')
      .send({
        primary_provider: 'openai',
        api_endpoint: ''
      });

    expect(res.status).toBe(200);
    expect(cloudLLMService.testConnection).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: '',
      api_key: 'stored-live-key'
    });
    expect(res.body).toEqual({ success: true, message: 'ok' });
  });

  it('uses the stored API key for /settings/ai/models when the request sends a masked key', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'stored-live-key' }]
    });
    cloudLLMService.getModels.mockResolvedValueOnce([{ id: 'gpt-5.2', name: 'gpt-5.2' }]);

    const res = await request(app)
      .post('/settings/ai/models')
      .send({
        primary_provider: 'openai',
        api_key: '••••••••-masked'
      });

    expect(res.status).toBe(200);
    expect(cloudLLMService.getModels).toHaveBeenCalledWith({
      primary_provider: 'openai',
      api_endpoint: undefined,
      api_key: 'stored-live-key'
    });
    expect(res.body).toEqual({
      success: true,
      models: [{ id: 'gpt-5.2', name: 'gpt-5.2' }]
    });
  });

  it('returns 400 from /settings/ai/models when no request or stored API key exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/ai/models')
      .send({
        primary_provider: 'openai'
      });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      success: false,
      error: 'API key is required',
      models: []
    });
    expect(cloudLLMService.getModels).not.toHaveBeenCalled();
  });

  it('returns an in-band failure payload from /settings/ai/models when model lookup throws', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'stored-live-key' }]
    });
    cloudLLMService.getModels.mockRejectedValueOnce(new Error('provider unavailable'));

    const res = await request(app)
      .post('/settings/ai/models')
      .send({
        primary_provider: 'openai'
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: false,
      error: 'provider unavailable',
      models: []
    });
  });

  it('returns the stable usage fallback payload when AI usage tables are not ready', async () => {
    const tableMissing = new Error('relation "ai_usage_log" does not exist');
    tableMissing.code = '42P01';
    db.query.mockRejectedValueOnce(tableMissing);

    const res = await request(app).get('/settings/ai/usage');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      currentMonth: { requests: 0, tokens: 0, cost: 0, avgCostPerCall: 0 },
      lastMonth: { requests: 0, tokens: 0, cost: 0 },
      budget: { limit: null, used: 0, alertThreshold: 80 },
      recentRequests: []
    });
  });

  it('returns 500 from GET /settings/ai when config lookup fails unexpectedly', async () => {
    db.query.mockRejectedValueOnce(new Error('db offline'));

    const res = await request(app).get('/settings/ai');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'db offline' });
  });

  it('rejects invalid Issue 275 payload keys before opening a transaction', async () => {
    ragLoopConfig.validateIssue275PayloadKeys.mockReturnValueOnce({
      valid: false,
      unknownKeys: ['foo'],
      disallowedKeys: ['legacy_bar']
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({ foo: true, legacy_bar: false });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Invalid Issue 275 configuration keys in payload',
      unknown_issue275_keys: ['foo'],
      disallowed_v11_keys: ['legacy_bar']
    });
    expect(db.pool.connect).not.toHaveBeenCalled();
  });

  it('rolls back and rejects formula weights that do not sum to 1.0', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
        return {
          rows: [{
            id: 1,
            formula_pattern_weight: 0.40,
            formula_rule_weight: 0.30,
            formula_rag_weight: 0.20,
            formula_history_weight: 0.10
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({
        formula_pattern_weight: 0.50,
        formula_rule_weight: 0.30,
        formula_rag_weight: 0.20,
        formula_history_weight: 0.20
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Formula weights must sum to 1.0');
    expect(res.body.currentSum).toBeCloseTo(1.2, 5);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('clears embeddings and invalidates both image embedding caches when identities change', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    const existingConfig = {
      id: 1,
      primary_provider: 'openai',
      embedding_provider_mode: 'same',
      embedding_provider: 'auto',
      embedding_model: 'text-embedding-3-small',
      image_embedding_local_host: '127.0.0.1',
      image_embedding_local_port: 8000,
      image_embedding_cloud_provider: 'openai',
      image_embedding_cloud_api_endpoint: 'https://old.example.test',
      image_embedding_models_cache: {
        local: ['local-a'],
        cloud: ['cloud-a'],
        preserved: ['keep-me']
      }
    };

    const latestConfig = {
      ...existingConfig,
      embedding_provider_mode: 'cloud',
      embedding_cloud_provider: 'voyage',
      embedding_cloud_model: 'voyage-2',
      image_embedding_local_host: 'localhost',
      image_embedding_cloud_provider: 'cohere',
      image_embedding_cloud_api_endpoint: 'https://new.example.test'
    };

    let selectCount = 0;
    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
        selectCount += 1;
        return { rows: [selectCount === 1 ? existingConfig : latestConfig] };
      }
      if (sql === 'DELETE FROM classification_embeddings') {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
        return { rows: [] };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE ai_provider_config') && sql.includes('image_embedding_models_cache')) {
        expect(params).toEqual([{ preserved: ['keep-me'] }]);
        return { rows: [] };
      }
      return { rows: [latestConfig] };
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({
        embedding_provider_mode: 'cloud',
        embedding_cloud_provider: 'voyage',
        embedding_cloud_model: 'voyage-2',
        image_embedding_local_host: 'localhost',
        image_embedding_cloud_provider: 'cohere',
        image_embedding_cloud_api_endpoint: 'https://new.example.test'
      });

    expect(res.status).toBe(200);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM classification_embeddings');
    const cacheResetCall = client.query.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('image_embedding_models_cache = $1')
    );
    expect(cacheResetCall).toBeDefined();
    expect(cacheResetCall[1]).toEqual([{ preserved: ['keep-me'] }]);
  });

  it('returns 500 and rolls back when AI settings persistence fails', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
        return { rows: [{}] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
        throw new Error('insert failed');
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({ model: 'gpt-5.2' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'insert failed' });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('still returns 500 when rollback itself fails during AI settings persistence', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN') {
        return { rows: [] };
      }
      if (sql === 'ROLLBACK') {
        throw new Error('rollback failed');
      }
      if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
        return { rows: [{}] };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
        throw new Error('insert failed');
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/ai')
      .send({ model: 'gpt-5.2' });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'insert failed' });
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns 400 from /settings/ai/test when no request or stored API key exists', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/settings/ai/test')
      .send({ primary_provider: 'openai' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'API key is required' });
    expect(cloudLLMService.testConnection).not.toHaveBeenCalled();
  });

  it('returns an in-band failure payload from /settings/ai/test when provider probing throws', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ api_key: 'stored-live-key' }]
    });
    cloudLLMService.testConnection.mockRejectedValueOnce(new Error('provider unavailable'));

    const res = await request(app)
      .post('/settings/ai/test')
      .send({ primary_provider: 'openai' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: false, error: 'provider unavailable' });
  });

  it('returns parsed AI usage statistics when usage tables exist', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{
          total_requests: '12',
          total_tokens: '3456',
          total_cost: '4.50',
          avg_cost_per_call: '0.375',
          successful_requests: '9'
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          total_requests: '8',
          total_tokens: '2222',
          total_cost_usd: '3.25'
        }]
      })
      .mockResolvedValueOnce({
        rows: [{
          monthly_budget_usd: '10',
          current_month_usage_usd: '4.5',
          budget_alert_threshold: 75
        }]
      })
      .mockResolvedValueOnce({
        rows: [{ provider: 'openai', model: 'gpt-5.2' }]
      });

    const res = await request(app).get('/settings/ai/usage');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      currentMonth: {
        requests: 12,
        tokens: 3456,
        cost: 4.5,
        avgCostPerCall: 0.375,
        successRate: 75
      },
      lastMonth: {
        requests: 8,
        tokens: 2222,
        cost: 3.25
      },
      budget: {
        limit: 10,
        used: 4.5,
        alertThreshold: 75,
        percentUsed: 45
      },
      recentRequests: [{ provider: 'openai', model: 'gpt-5.2' }]
    });
  });

  it('returns 500 from /settings/ai/usage on unexpected usage lookup failures', async () => {
    db.query.mockRejectedValueOnce(new Error('usage query failed'));

    const res = await request(app).get('/settings/ai/usage');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'usage query failed' });
  });

  it('returns AI router status from /settings/ai/status', async () => {
    aiRouterService.getStatus.mockResolvedValueOnce({
      activeProvider: 'openai',
      configured: true
    });

    const res = await request(app).get('/settings/ai/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      activeProvider: 'openai',
      configured: true
    });
  });

  it('returns 500 from /settings/ai/status when status lookup fails', async () => {
    aiRouterService.getStatus.mockRejectedValueOnce(new Error('status failed'));

    const res = await request(app).get('/settings/ai/status');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'status failed' });
  });

  it('resets AI usage successfully', async () => {
    cloudLLMService.resetMonthlyUsage.mockResolvedValueOnce();

    const res = await request(app).post('/settings/ai/reset-usage');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Monthly usage reset successfully'
    });
  });

  it('returns 500 from /settings/ai/reset-usage when reset fails', async () => {
    cloudLLMService.resetMonthlyUsage.mockRejectedValueOnce(new Error('reset failed'));

    const res = await request(app).post('/settings/ai/reset-usage');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'reset failed' });
  });

  describe('sidecar API key (image_embedding_local_api_key) — Issue #330 Gap 5.3', () => {
    it('GET /settings/ai — masks image_embedding_local_api_key when an encrypted value is stored', async () => {
      // Stored value is formatted as enc_<plaintext>$iv$tag (per our mock)
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          image_embedding_local_api_key: 'enc_mysecretkey$testiv$testtag'
        }]
      });

      const res = await request(app).get('/settings/ai');

      expect(res.status).toBe(200);
      // Should not expose the raw encrypted string
      expect(res.body.image_embedding_local_api_key).not.toBe('enc_mysecretkey$testiv$testtag');
      // Should not expose the plaintext (decrypted value via mock = 'mysecretkey')
      expect(res.body.image_embedding_local_api_key).not.toBe('mysecretkey');
      // Should be a masked token (starts with bullet dots)
      expect(res.body.image_embedding_local_api_key).toMatch(/^••••••••/);
    });

    it('GET /settings/ai — leaves image_embedding_local_api_key falsy when column is null', async () => {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, image_embedding_local_api_key: null }]
      });

      const res = await request(app).get('/settings/ai');

      expect(res.status).toBe(200);
      expect(res.body.image_embedding_local_api_key).toBeFalsy();
    });

    it('PUT /settings/ai — encrypts image_embedding_local_api_key when a new plaintext key is sent', async () => {
      const { encryptValue, formatEncryptedValue } = require('../utils/encryption');
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValueOnce(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') return { rows: [{}] };
        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          capturedParams = params;
          return { rows: [] };
        }
        return { rows: [{}] };
      });

      await request(app).put('/settings/ai').send({ image_embedding_local_api_key: 'newsecret' });

      // encryptValue and formatEncryptedValue should have been called with the plaintext
      expect(encryptValue).toHaveBeenCalledWith('newsecret');
      expect(formatEncryptedValue).toHaveBeenCalled();
      // The stored param ($59, index 58) should be the formatted encrypted string, not the plaintext
      expect(capturedParams[58]).toBe('enc_newsecret$testiv$testtag');
    });

    it('PUT /settings/ai — preserves existing encrypted key when a masked value is sent', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValueOnce(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          return { rows: [{ image_embedding_local_api_key: 'enc_existing$testiv$testtag' }] };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          capturedParams = params;
          return { rows: [] };
        }
        return { rows: [{}] };
      });

      await request(app).put('/settings/ai').send({ image_embedding_local_api_key: '••••••••abcd' });

      // Existing encrypted value should be preserved unchanged
      expect(capturedParams[58]).toBe('enc_existing$testiv$testtag');
    });

    it('PUT /settings/ai — sets image_embedding_local_api_key to null when empty string is sent (clear)', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValueOnce(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') {
          return { rows: [{ image_embedding_local_api_key: 'enc_existing$testiv$testtag' }] };
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          capturedParams = params;
          return { rows: [] };
        }
        return { rows: [{}] };
      });

      await request(app).put('/settings/ai').send({ image_embedding_local_api_key: '' });

      // Empty string → null (key cleared)
      expect(capturedParams[58]).toBeNull();
    });

    it('PUT /settings/ai — passes image_embedding_local_timeout_ms to the DB ($60)', async () => {
      const client = { query: jest.fn(), release: jest.fn() };
      db.pool.connect.mockResolvedValueOnce(client);

      let capturedParams;
      client.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN' || sql === 'COMMIT') return { rows: [] };
        if (sql === 'SELECT * FROM ai_provider_config WHERE id = 1') return { rows: [{}] };
        if (typeof sql === 'string' && sql.includes('INSERT INTO ai_provider_config')) {
          capturedParams = params;
          return { rows: [] };
        }
        return { rows: [{}] };
      });

      await request(app).put('/settings/ai').send({ image_embedding_local_timeout_ms: 30000 });

      // $60 is at index 59
      expect(capturedParams[59]).toBe(30000);
    });
  });
});
