/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDb = {
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
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

jest.mock('../config/database', () => mockDb);
jest.unstable_mockModule('../config/database', () => ({ ...mockDb, default: mockDb }));
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDb, default: mockDb }));

jest.mock('../services/radarr', () => mockRadarr);
jest.unstable_mockModule('../services/radarr', () => ({ ...mockRadarr, default: mockRadarr }));
jest.unstable_mockModule('../services/radarr.mjs', () => ({ ...mockRadarr, default: mockRadarr }));

jest.mock('../services/sonarr', () => mockSonarr);
jest.unstable_mockModule('../services/sonarr', () => ({ ...mockSonarr, default: mockSonarr }));
jest.unstable_mockModule('../services/sonarr.mjs', () => ({ ...mockSonarr, default: mockSonarr }));

jest.mock('../services/ollama', () => mockOllama);
jest.unstable_mockModule('../services/ollama', () => ({ ...mockOllama, default: mockOllama }));
jest.unstable_mockModule('../services/ollama.mjs', () => ({ ...mockOllama, default: mockOllama }));

jest.mock('../services/tmdb', () => mockTmdb);
jest.unstable_mockModule('../services/tmdb', () => ({ ...mockTmdb, default: mockTmdb }));
jest.unstable_mockModule('../services/tmdb.mjs', () => ({ ...mockTmdb, default: mockTmdb }));

jest.mock('../services/tavily', () => mockTavily);
jest.unstable_mockModule('../services/tavily', () => ({ ...mockTavily, default: mockTavily }));
jest.unstable_mockModule('../services/tavily.mjs', () => ({ ...mockTavily, default: mockTavily }));

jest.mock('../services/omdb', () => mockOmdb);
jest.unstable_mockModule('../services/omdb', () => ({ ...mockOmdb, default: mockOmdb }));
jest.unstable_mockModule('../services/omdb.mjs', () => ({ ...mockOmdb, default: mockOmdb }));

jest.mock('../services/discordBot', () => mockDiscordBot);
jest.unstable_mockModule('../services/discordBot', () => ({ ...mockDiscordBot, default: mockDiscordBot }));
jest.unstable_mockModule('../services/discordBot.mjs', () => ({ ...mockDiscordBot, default: mockDiscordBot }));

jest.mock('../services/startupService', () => mockStartupService);
jest.unstable_mockModule('../services/startupService', () => ({ ...mockStartupService, default: mockStartupService }));
jest.unstable_mockModule('../services/startupService.mjs', () => ({ ...mockStartupService, default: mockStartupService }));

jest.mock('../services/pathTestService', () => mockPathTestService);
jest.unstable_mockModule('../services/pathTestService', () => ({ ...mockPathTestService, default: mockPathTestService }));
jest.unstable_mockModule('../services/pathTestService.mjs', () => ({ ...mockPathTestService, default: mockPathTestService }));

jest.mock('../services/embeddingProvider', () => mockEmbeddingProvider);
jest.unstable_mockModule('../services/embeddingProvider', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));
jest.unstable_mockModule('../services/embeddingProvider.mjs', () => ({ ...mockEmbeddingProvider, default: mockEmbeddingProvider }));

jest.mock('../services/embeddingRouter', () => mockEmbeddingRouter);
jest.unstable_mockModule('../services/embeddingRouter', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));
jest.unstable_mockModule('../services/embeddingRouter.mjs', () => ({ ...mockEmbeddingRouter, default: mockEmbeddingRouter }));

jest.mock('../services/aiRouter', () => mockAiRouter);
jest.unstable_mockModule('../services/aiRouter', () => ({ ...mockAiRouter, default: mockAiRouter }));
jest.unstable_mockModule('../services/aiRouter.mjs', () => ({ ...mockAiRouter, default: mockAiRouter }));

jest.mock('../services/cloudLLM', () => mockCloudLLM);
jest.unstable_mockModule('../services/cloudLLM', () => ({ ...mockCloudLLM, default: mockCloudLLM }));
jest.unstable_mockModule('../services/cloudLLM.mjs', () => ({ ...mockCloudLLM, default: mockCloudLLM }));

jest.mock('../services/webhook', () => mockWebhook);
jest.unstable_mockModule('../services/webhook', () => ({ ...mockWebhook, default: mockWebhook }));
jest.unstable_mockModule('../services/webhook.mjs', () => ({ ...mockWebhook, default: mockWebhook }));

jest.mock('../services/providerLock', () => mockProviderLock);
jest.unstable_mockModule('../services/providerLock', () => ({ ...mockProviderLock, default: mockProviderLock }));
jest.unstable_mockModule('../services/providerLock.mjs', () => ({ ...mockProviderLock, default: mockProviderLock }));

jest.mock('../services/autoLearningService', () => mockAutoLearningService);
jest.unstable_mockModule('../services/autoLearningService', () => ({ ...mockAutoLearningService, default: mockAutoLearningService }));
jest.unstable_mockModule('../services/autoLearningService.mjs', () => ({ ...mockAutoLearningService, default: mockAutoLearningService }));

jest.mock('../middleware/auth', () => mockAuth);
jest.unstable_mockModule('../middleware/auth', () => ({ ...mockAuth, default: mockAuth }));
jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

jest.mock('../utils/logger', () => mockLogger);
jest.unstable_mockModule('../utils/logger', () => ({ ...mockLogger, default: mockLogger }));
jest.unstable_mockModule('../utils/logger.mjs', () => ({ ...mockLogger, default: mockLogger }));

jest.mock('../utils/ragLoopConfig', () => mockRagLoopConfig);
jest.unstable_mockModule('../utils/ragLoopConfig', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));
jest.unstable_mockModule('../utils/ragLoopConfig.mjs', () => ({ ...mockRagLoopConfig, default: mockRagLoopConfig }));

const { createSettingsTestRouter } = await import('./setup/createSettingsTestRouter.js');

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
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);
    client.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .put('/settings/confidence')
      .send(['bad'])
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be a valid object' });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(autoLearningService.clearCache).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
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
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(autoLearningService.clearCache).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
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
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValueOnce(client);
    client.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post('/settings/confidence/import')
      .send({ settings: { bad: true } })
      .expect(400);

    expect(res.body).toEqual({ error: 'Settings must be an array' });
    expect(client.query).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(client.query).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
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
