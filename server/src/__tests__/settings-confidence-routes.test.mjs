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

const mockRadarr = {};

const mockSonarr = {};

const mockOllama = {
  resetConfig: jest.fn(),
};

const mockTmdb = {};

const mockTavily = {};

const mockOmdb = {};

const mockDiscordBot = {};

const mockStartupService = {};

const mockPathTestService = {};

const mockEmbeddingProvider = {
  resetConfig: jest.fn(),
};

const mockEmbeddingRouter = {
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
};

const mockAiRouter = {
  clearCache: jest.fn(),
  getStatus: jest.fn(),
};

const mockCloudLLM = {
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
};

const mockWebhook = {};

const mockProviderLock = {
  config: {
    heartbeatTimeout: 30000,
    heartbeatInterval: 5000,
    maxWaitTime: 120000,
  },
  updateConfig: jest.fn().mockResolvedValue(undefined),
  getLockStatus: jest.fn().mockReturnValue({
    isLocked: false,
    lockedBy: null,
    config: {
      heartbeatTimeout: 30000,
      heartbeatInterval: 5000,
      maxWaitTime: 120000,
    },
  }),
};

const mockAutoLearningService = {
  clearCache: jest.fn(),
};

const mockAuth = {
  authenticateToken: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
};

const mockLogger = {
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
};

const mockRagLoopConfig = {
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
};

jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDb));

jest.unstable_mockModule('../services/radarr.mjs', () => createNamedMockModule('radarrService', mockRadarr));

jest.unstable_mockModule('../services/sonarr.mjs', () => createNamedMockModule('sonarrService', mockSonarr));

jest.unstable_mockModule('../services/ollama.mjs', () => createNamedMockModule('ollamaService', mockOllama));

jest.unstable_mockModule('../services/tmdb.mjs', () => createNamedMockModule('tmdbService', mockTmdb));

jest.unstable_mockModule('../services/tavily.mjs', () => createNamedMockModule('tavilyService', mockTavily));

jest.unstable_mockModule('../services/omdb.mjs', () => createNamedMockModule('omdbService', mockOmdb));

jest.unstable_mockModule('../services/discordBot.mjs', () => createNamedMockModule('discordBotService', mockDiscordBot));

jest.unstable_mockModule('../services/startupService.mjs', () => createNamedMockModule('startupService', mockStartupService));

jest.unstable_mockModule('../services/pathTestService.mjs', () => createNamedMockModule('pathTestService', mockPathTestService));

jest.unstable_mockModule('../services/embeddingProvider.mjs', () => createNamedMockModule('embeddingProvider', mockEmbeddingProvider));

jest.unstable_mockModule('../services/embeddingRouter.mjs', () => createNamedMockModule('embeddingRouter', mockEmbeddingRouter));

jest.unstable_mockModule('../services/aiRouter.mjs', () => createNamedMockModule('aiRouterService', mockAiRouter));

jest.unstable_mockModule('../services/cloudLLM.mjs', () => createNamedMockModule('cloudLLMService', mockCloudLLM));

jest.unstable_mockModule('../services/webhook.mjs', () => createNamedMockModule('webhookService', mockWebhook));

jest.unstable_mockModule('../services/providerLock.mjs', () => createNamedMockModule('providerLock', mockProviderLock));

jest.unstable_mockModule('../services/autoLearningService.mjs', () => createNamedMockModule('autoLearningService', mockAutoLearningService));

jest.unstable_mockModule('../middleware/auth.mjs', () => createNamedMockModule('router', mockAuth));

jest.unstable_mockModule('../utils/logger.mjs', () => createMockModule(mockLogger));

mockRagLoopConfig.RAG_LOOP_V1_KEYS = [];
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => createNamedMockModule('DEFAULT_IDENTIFIER_CAPS', mockRagLoopConfig));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.mjs');

const db = mockDb;
const autoLearningService = mockAutoLearningService;

describe('Settings confidence route helpers', () => {
  let app;
  let settingsRouter;

  beforeAll(async () => {
    settingsRouter = await createSettingsTestRouter(express);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/settings', settingsRouter);
  });

  it('loads confidence settings as a keyed object', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          setting_key: 'classification_threshold',
          setting_value: '0.75',
          description: 'Classification threshold',
          default_value: '0.70',
        },
        {
          setting_key: 'auto_verify_threshold',
          setting_value: '0.90',
          description: 'Auto verify threshold',
          default_value: '0.85',
        },
      ],
    });

    const res = await request(app)
      .get('/settings/confidence')
      .expect(200);

    expect(res.body).toEqual({
      classification_threshold: {
        value: '0.75',
        description: 'Classification threshold',
        default: '0.70',
      },
      auto_verify_threshold: {
        value: '0.90',
        description: 'Auto verify threshold',
        default: '0.85',
      },
    });
  });

  it('rejects array payloads for PUT /settings/confidence', async () => {
    const res = await request(app)
      .put('/settings/confidence')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(autoLearningService.clearCache).not.toHaveBeenCalled();
  });

  it('ignores deprecated confidence keys and updates valid settings', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT setting_key FROM confidence_settings') {
        return {
          rows: [{ setting_key: 'classification_threshold' }],
        };
      }
      if (sql === 'SELECT setting_value FROM confidence_settings WHERE setting_key = $1 FOR UPDATE') {
        expect(params).toEqual(['classification_threshold']);
        return {
          rows: [{ setting_value: '0.70' }],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE confidence_settings')) {
        expect(params).toEqual(['0.82', 'classification_threshold']);
        return { rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO confidence_settings_audit')) {
        expect(params[0]).toBe('classification_threshold');
        expect(params[1]).toBe('0.70');
        expect(params[2]).toBe('0.82');
        expect(params[4]).toBe('Manual update');
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .put('/settings/confidence')
      .send({
        classification_threshold: '0.82',
        discord_auto_route_threshold: '0.95',
      })
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      message: 'Settings updated successfully',
    });
    expect(autoLearningService.clearCache).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when reverting an audit entry for a missing setting row', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'ROLLBACK') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM confidence_settings_audit WHERE id = $1') {
        expect(params).toEqual(['44']);
        return {
          rows: [{
            id: 44,
            setting_key: 'classification_threshold',
            old_value: '0.70',
            new_value: '0.82',
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE confidence_settings')) {
        return { rowCount: 0 };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .post('/settings/confidence/revert/44')
      .expect(404);

    expect(res.body).toEqual({
      error: 'Setting not found: classification_threshold',
    });
    expect(autoLearningService.clearCache).not.toHaveBeenCalled();
  });

  it('clears auto-learning cache after a successful confidence revert', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT * FROM confidence_settings_audit WHERE id = $1') {
        return {
          rows: [{
            id: 44,
            setting_key: 'classification_threshold',
            old_value: '0.70',
            new_value: '0.82',
          }],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE confidence_settings')) {
        return { rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO confidence_settings_audit')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await request(app)
      .post('/settings/confidence/revert/44')
      .expect(200);

    expect(autoLearningService.clearCache).toHaveBeenCalledTimes(1);
  });

  it('exports confidence settings with metadata', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{
        setting_key: 'classification_threshold',
        setting_value: '0.75',
      }],
    });

    const res = await request(app)
      .post('/settings/confidence/export')
      .expect(200);

    expect(res.body.version).toBe('1.0');
    expect(res.body.exportedBy).toBe('unknown');
    expect(Array.isArray(res.body.settings)).toBe(true);
    expect(res.body.settings).toEqual([{
      setting_key: 'classification_threshold',
      setting_value: '0.75',
    }]);
  });

  it('rejects non-array settings in confidence import payloads', async () => {
    const res = await request(app)
      .post('/settings/confidence/import')
      .send({ settings: { bad: true } })
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be an array' });
  });

  it('clears auto-learning cache after a successful confidence import', async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);

    client.query.mockImplementation(async (sql, params) => {
      if (sql === 'BEGIN' || sql === 'COMMIT') {
        return { rows: [] };
      }
      if (sql === 'SELECT setting_key FROM confidence_settings') {
        return {
          rows: [{ setting_key: 'classification_threshold' }],
        };
      }
      if (sql === 'SELECT setting_value FROM confidence_settings WHERE setting_key = $1') {
        expect(params).toEqual(['classification_threshold']);
        return {
          rows: [{ setting_value: '0.70' }],
        };
      }
      if (typeof sql === 'string' && sql.includes('UPDATE confidence_settings')) {
        return { rowCount: 1 };
      }
      if (typeof sql === 'string' && sql.includes('INSERT INTO confidence_settings_audit')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .post('/settings/confidence/import')
      .send({
        settings: [{
          setting_key: 'classification_threshold',
          setting_value: '0.82',
        }]
      })
      .expect(200);

    expect(res.body).toEqual({
      success: true,
      message: 'Settings imported successfully',
    });
    expect(autoLearningService.clearCache).toHaveBeenCalledTimes(1);
  });
});
