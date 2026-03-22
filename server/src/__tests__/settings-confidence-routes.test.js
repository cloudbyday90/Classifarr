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

jest.mock('../services/radarr', () => ({}));
jest.mock('../services/sonarr', () => ({}));
jest.mock('../services/ollama', () => ({
  resetConfig: jest.fn(),
}));
jest.mock('../services/tmdb', () => ({}));
jest.mock('../services/tavily', () => ({}));
jest.mock('../services/omdb', () => ({}));
jest.mock('../services/discordBot', () => ({}));
jest.mock('../services/startupService', () => ({}));
jest.mock('../services/pathTestService', () => ({}));
jest.mock('../services/embeddingProvider', () => ({
  resetConfig: jest.fn(),
}));
jest.mock('../services/embeddingRouter', () => ({
  resetConfig: jest.fn(),
  clearCache: jest.fn(),
}));
jest.mock('../services/aiRouter', () => ({
  clearCache: jest.fn(),
  getStatus: jest.fn(),
}));
jest.mock('../services/cloudLLM', () => ({
  testConnection: jest.fn(),
  getModels: jest.fn(),
  resetMonthlyUsage: jest.fn(),
}));
jest.mock('../services/webhook', () => ({}));
jest.mock('../services/providerLock', () => ({
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
}));
jest.mock('../services/autoLearningService', () => ({
  clearCache: jest.fn(),
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
  }),
}));

jest.mock('../utils/ragLoopConfig', () => ({
  getRagLoopDefaultConfig: jest.fn(() => ({})),
  validateAndNormalizeRagLoopConfig: jest.fn(config => ({ normalizedConfig: config, warnings: [] })),
  validateIssue275PayloadKeys: jest.fn(() => ({ valid: true, unknownKeys: [], disallowedKeys: [] })),
}));

const db = require('../config/database');
const autoLearningService = require('../services/autoLearningService');
const settingsRouter = require('../routes/settings');

describe('Settings confidence route helpers', () => {
  let app;

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
