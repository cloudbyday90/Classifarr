const request = require('supertest');
const express = require('express');
const logsRouter = require('../routes/logs');
const db = require('../config/database');

// Mock the database module
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

// Mock the logger module
jest.mock('../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn()
  }))
}));

describe('Logs API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/logs', logsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/logs', () => {
    test('should return logs with pagination', async () => {
      const mockLogs = [
        {
          id: 1,
          error_id: 'test-uuid-1',
          level: 'ERROR',
          module: 'TestModule',
          message: 'Test error',
          created_at: new Date().toISOString()
        }
      ];

      db.query
        .mockResolvedValueOnce({ rows: mockLogs })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(200);
      expect(response.body.logs).toEqual(mockLogs);
      expect(response.body.total).toBe(1);
      expect(response.body.limit).toBe(100);
      expect(response.body.offset).toBe(0);
    });

    test('should handle database errors', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/logs');

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/logs/error/:errorId', () => {
    test('should return error by UUID', async () => {
      const mockError = {
        id: 1,
        error_id: 'test-uuid-1',
        level: 'ERROR',
        module: 'TestModule',
        message: 'Test error',
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockError] });

      const response = await request(app).get('/api/logs/error/test-uuid-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockError);
    });

    test('should return 404 when error not found', async () => {
      db.query.mockResolvedValue({ rows: [] });

      const response = await request(app).get('/api/logs/error/nonexistent-uuid');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Error not found');
    });
  });

  describe('GET /api/logs/stats', () => {
    test('should return error statistics', async () => {
      const mockStats = {
        total_errors: '10',
        error_count: '8',
        warn_count: '2',
        resolved_count: '5',
        last_24h: '3',
        last_7d: '7'
      };

      const mockByModule = [
        { module: 'TestModule', count: '5' }
      ];

      const mockRecent = [
        { error_id: 'uuid-1', module: 'TestModule', message: 'Error 1', created_at: new Date().toISOString() }
      ];

      db.query
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: mockByModule })
        .mockResolvedValueOnce({ rows: mockRecent });

      const response = await request(app).get('/api/logs/stats');

      expect(response.status).toBe(200);
      expect(response.body.summary).toEqual(mockStats);
      expect(response.body.byModule).toEqual(mockByModule);
      expect(response.body.recentErrors).toEqual(mockRecent);
    });
  });

  describe('POST /api/logs/error/:errorId/resolve', () => {
    test('should mark error as resolved', async () => {
      db.query.mockResolvedValue({ rowCount: 1 });

      const response = await request(app)
        .post('/api/logs/error/test-uuid-1/resolve')
        .send({ notes: 'Fixed' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/logs/error/:errorId/report', () => {
    test('should generate markdown bug report', async () => {
      const mockError = {
        id: 1,
        error_id: 'test-uuid-1',
        level: 'ERROR',
        module: 'TestModule',
        message: 'Test error message',
        stack_trace: 'Error stack trace',
        system_context: { nodeVersion: 'v18.0.0', appVersion: '1.0.0' },
        request_context: { url: '/test', method: 'GET' },
        metadata: {},
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockError] });

      const response = await request(app).get('/api/logs/error/test-uuid-1/report');

      expect(response.status).toBe(200);
      expect(response.type).toMatch(/markdown/);
      expect(response.text).toContain('Bug Report: test-uuid-1');
      expect(response.text).toContain('Test error message');
    });

    test('should return JSON format when requested', async () => {
      const mockError = {
        id: 1,
        error_id: 'test-uuid-1',
        level: 'ERROR',
        module: 'TestModule',
        message: 'Test error',
        system_context: {},
        request_context: {},
        metadata: {},
        created_at: new Date().toISOString()
      };

      db.query.mockResolvedValue({ rows: [mockError] });

      const response = await request(app).get('/api/logs/error/test-uuid-1/report?format=json');

      expect(response.status).toBe(200);
      expect(response.body.report).toBeDefined();
      expect(response.body.error).toEqual(mockError);
    });
  });
});
