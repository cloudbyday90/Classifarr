/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLogger, sanitizeData, getSystemContext, setLoggerDb } from '../utils/logger.mjs';

const mockDb = { query: jest.fn() };

jest.unstable_mockModule('../config/database.mjs', () => ({
  ...mockDb,
  default: mockDb,
}));

jest.unstable_mockModule('../middleware/auth.mjs', () => ({
  authenticateToken: (_req, _res, next) => next()
}));

const db = mockDb;
const { withConsoleSpy } = await import('./setup/consoleHelpers.mjs');

describe('Logger', () => {
  let logger;

  beforeEach(() => {
    setLoggerDb(db);
    logger = createLogger('TestModule');
    jest.clearAllMocks();
  });

  describe('sanitizeData', () => {
    test('should redact sensitive fields', () => {
      const data = {
        username: 'testuser',
        password: 'secret123',
        api_key: 'abc123',
        token: 'xyz789',
        normalField: 'visible'
      };

      const sanitized = sanitizeData(data);

      expect(sanitized.username).toBe('testuser');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.api_key).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.normalField).toBe('visible');
    });

    test('should handle nested objects', () => {
      const data = {
        user: {
          name: 'test',
          password: 'secret'
        }
      };

      const sanitized = sanitizeData(data);

      expect(sanitized.user.name).toBe('test');
      expect(sanitized.user.password).toBe('[REDACTED]');
    });

    test('should handle arrays', () => {
      const data = {
        items: [
          { name: 'item1', token: 'secret1' },
          { name: 'item2', token: 'secret2' }
        ]
      };

      const sanitized = sanitizeData(data);

      expect(sanitized.items[0].name).toBe('item1');
      expect(sanitized.items[0].token).toBe('[REDACTED]');
      expect(sanitized.items[1].name).toBe('item2');
      expect(sanitized.items[1].token).toBe('[REDACTED]');
    });
  });

  describe('getSystemContext', () => {
    test('should return system information', () => {
      const context = getSystemContext();

      expect(context).toHaveProperty('nodeVersion');
      expect(context).toHaveProperty('platform');
      expect(context).toHaveProperty('arch');
      expect(context).toHaveProperty('uptime');
      expect(context).toHaveProperty('memory');
      expect(context).toHaveProperty('hostname');
    });
  });

  describe('error logging', () => {
    test('should persist error to database', async () => {
      const errorId = '123e4567-e89b-12d3-a456-426614174000';
      await withConsoleSpy('error', { suppress: true }, async () => {
        db.query.mockResolvedValue({
          rows: [{ error_id: errorId }]
        });

        const result = await logger.error('Test error', { code: 500 });

        expect(db.query).toHaveBeenCalled();
        expect(result).toBe(errorId);
      });
    });

    test('should handle database failures gracefully', async () => {
      await withConsoleSpy('error', { suppress: true }, async () => {
        db.query.mockRejectedValue(new Error('Database error'));

        const result = await logger.error('Test error');

        expect(result).toBeNull();
      });
    });

    test('should capture request context when provided', async () => {
      const errorId = '123e4567-e89b-12d3-a456-426614174000';
      await withConsoleSpy('error', { suppress: true }, async () => {
        db.query.mockResolvedValue({
          rows: [{ error_id: errorId }]
        });

        const mockReq = {
          method: 'GET',
          url: '/test',
          path: '/test',
          params: {},
          query: {},
          get: jest.fn(() => 'test-agent'),
          ip: '127.0.0.1'
        };

        await logger.error('Test error', {}, { req: mockReq });

        const callArgs = db.query.mock.calls[0];
        expect(callArgs[0]).toContain('INSERT INTO error_log');
        expect(callArgs[1]).toHaveLength(7);
      });
    });

    test('should skip database persistence when skipDbPersist is true', async () => {
      await withConsoleSpy('error', { suppress: true }, async () => {
        const result = await logger.error('No DB write error', { code: 500 }, { skipDbPersist: true });
        expect(result).toBeNull();
        expect(db.query).not.toHaveBeenCalled();
      });
    });
  });

  describe('warn logging', () => {
    test('should persist warning to database', async () => {
      const errorId = '123e4567-e89b-12d3-a456-426614174000';
      await withConsoleSpy('warn', { suppress: true }, async () => {
        db.query.mockResolvedValue({
          rows: [{ error_id: errorId }]
        });

        const result = await logger.warn('Test warning', { code: 400 });

        expect(db.query).toHaveBeenCalled();
        expect(result).toBe(errorId);
      });
    });

    test('should skip database persistence when skipDbPersist is true', async () => {
      await withConsoleSpy('warn', { suppress: true }, async () => {
        const result = await logger.warn('No DB write warning', { code: 400 }, { skipDbPersist: true });
        expect(result).toBeNull();
        expect(db.query).not.toHaveBeenCalled();
      });
    });
  });

  describe('info and debug logging', () => {
    test('info should not persist to database', () => {
      logger.info('Test info');

      expect(db.query).not.toHaveBeenCalled();
    });

    test('debug should not persist to database', () => {
      logger.debug('Test debug');

      expect(db.query).not.toHaveBeenCalled();
    });
  });
});

describe('Logs API', () => {
  describe('GET /api/logs', () => {
    test('should return paginated logs', async () => {
      db.query.mockImplementation((query) => {
        if (query.includes('COUNT')) {
          return Promise.resolve({ rows: [{ total: '10' }] });
        }
        return Promise.resolve({
          rows: [
            { id: 1, error_id: 'test-id', level: 'ERROR', module: 'Test', message: 'Test error', created_at: new Date() }
          ]
        });
      });
    });
  });

  describe('GET /api/logs/stats', () => {
    test('should return aggregated statistics with merged trend query', async () => {
      db.query.mockImplementation((query) => {
        if (query.includes('total_errors')) {
          return Promise.resolve({
            rows: [{ total_errors: '5', total_warnings: '3', total_resolved: '2', unresolved_errors: '3' }]
          });
        }
        if (query.includes('GROUP BY module')) {
          return Promise.resolve({
            rows: [{ module: 'TestModule', count: '3' }]
          });
        }
        if (query.includes('logs_24h') && query.includes('logs_7d')) {
          return Promise.resolve({
            rows: [{
              logs_24h: '10', errors_24h: '2', warnings_24h: '3', info_24h: '4', debug_24h: '1',
              logs_7d:  '40', errors_7d:  '8', warnings_7d: '12', info_7d: '16', debug_7d: '4'
            }]
          });
        }
      });
    });
  });

  describe('GET /api/logs/error/:errorId/report', () => {
    test('should generate markdown bug report', async () => {
      const mockLog = {
        error_id: 'test-id',
        level: 'ERROR',
        module: 'TestModule',
        message: 'Test error',
        stack_trace: 'Error: Test\n  at test.js:1',
        request_context: { method: 'GET', url: '/test' },
        system_context: { nodeVersion: 'v18.0.0' },
        metadata: { code: 500 },
        created_at: new Date()
      };

      db.query.mockResolvedValue({ rows: [mockLog] });
    });
  });

  describe('POST /api/logs/error/:errorId/resolve', () => {
    test('should mark error as resolved', async () => {
      db.query.mockResolvedValue({
        rows: [{ error_id: 'test-id', resolved: true }]
      });
    });
  });

  describe('POST /api/logs/cleanup', () => {
    test('should delete old logs based on retention', async () => {
      db.query.mockImplementation((query) => {
        if (query.includes('SELECT key, value')) {
          return Promise.resolve({
            rows: [
              { key: 'log_retention_days', value: '30' },
              { key: 'error_log_retention_days', value: '90' }
            ]
          });
        }
        if (query.includes('DELETE FROM error_log')) {
          return Promise.resolve({ rows: [{ id: 1 }, { id: 2 }] });
        }
        if (query.includes('DELETE FROM app_log')) {
          return Promise.resolve({ rows: [{ id: 3 }] });
        }
      });
    });
  });
});

describe('GET /api/logs/stats — merged 24h/7d trend query', () => {
  const createRateLimit = jest.fn(() => (_req, _res, next) => next());
  const authenticateToken = (_req, _res, next) => next();
  const routeLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { createLogsRouter } = await import('../routes/logsRouteShared.mjs');
    app = express();
    app.use(express.json());
    app.use('/api/logs', createLogsRouter({
      express,
      rateLimit: createRateLimit,
      db,
      authenticateToken,
      logger: routeLogger,
    }));
    app.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ error: err.message });
    });
  });

  test('issues a single query covering both 24h and 7d windows and returns correct shape', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('total_errors')) {
        return Promise.resolve({ rows: [{ total_logs: '100', total_errors: '10', total_warnings: '20', total_info: '50', total_debug: '20', total_resolved: '5', unresolved_logs: '95', unresolved_errors: '10' }] });
      }
      if (sql.includes('GROUP BY module')) {
        return Promise.resolve({ rows: [{ module: 'QueueService', count: '8' }] });
      }
      if (sql.includes('logs_24h') && sql.includes('logs_7d')) {
        return Promise.resolve({ rows: [{
          logs_24h: '7', errors_24h: '2', warnings_24h: '3', info_24h: '1', debug_24h: '1',
          logs_7d: '30', errors_7d: '8', warnings_7d: '12', info_7d: '6', debug_7d: '4'
        }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get('/api/logs/stats').expect(200);

    expect(res.body.trends.last24h.logs_24h).toBe('7');
    expect(res.body.trends.last24h.errors_24h).toBe('2');
    expect(res.body.trends.last7d.logs_7d).toBe('30');
    expect(res.body.trends.last7d.errors_7d).toBe('8');
    const trendCalls = db.query.mock.calls.filter(([sql]) => sql.includes('logs_24h'));
    expect(trendCalls).toHaveLength(1);
    const [trendSql] = trendCalls[0];
    expect(trendSql).toContain('logs_7d');
    expect(trendSql).not.toMatch(/FROM error_log[\s\S]*FROM error_log/);
  });

  test('returns 500 when the merged trend query fails', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('total_errors')) return Promise.resolve({ rows: [{ total_logs: '0', total_errors: '0', total_warnings: '0', total_info: '0', total_debug: '0', total_resolved: '0', unresolved_logs: '0', unresolved_errors: '0' }] });
      if (sql.includes('GROUP BY module')) return Promise.resolve({ rows: [] });
      if (sql.includes('logs_24h')) return Promise.reject(new Error('trend query failed'));
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).get('/api/logs/stats').expect(500);
    expect(res.body.error).toContain('trend query failed');
  });
});
