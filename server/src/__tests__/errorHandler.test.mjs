import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockLogger = {
    error: jest.fn().mockResolvedValue('error-id-123'),
    warn: jest.fn().mockResolvedValue('warn-id-123'),
    info: jest.fn(),
    debug: jest.fn()
};

const createLogger = jest.fn(() => mockLogger);
jest.unstable_mockModule('../utils/logger.mjs', () => ({
  createLogger,
  default: { createLogger }
}));

const { default: errorHandler } = await import('../middleware/errorHandler.mjs');

describe('errorHandler middleware', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NODE_ENV = originalNodeEnv;
    });

    afterAll(() => {
        process.env.NODE_ENV = originalNodeEnv;
    });

    test('returns clean 400 for malformed JSON payloads without errorId', async () => {
        const app = express();
        app.use(express.json());
        app.post('/api/rag/backfill/manual/start', (req, res) => {
            res.json({ ok: true });
        });
        app.use(errorHandler);

        const response = await request(app)
            .post('/api/rag/backfill/manual/start')
            .set('Content-Type', 'application/json')
            .send("{'invalid': true}");

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toBe('Invalid JSON payload. Ensure the request body is valid JSON.');
        expect(response.body.errorId).toBeUndefined();
        expect(mockLogger.info).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('logs and returns errorId for 500 errors', async () => {
        const app = express();
        app.get('/boom', (req, res, next) => {
            next(new Error('kaboom'));
        });
        app.use(errorHandler);

        const response = await request(app).get('/boom');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal Server Error');
        expect(response.body.message).toBe('kaboom');
        expect(response.body.errorId).toBe('error-id-123');
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    test('sanitizes 500 messages in production', async () => {
        process.env.NODE_ENV = 'production';

        const app = express();
        app.get('/boom', (req, res, next) => {
            next(new Error('kaboom'));
        });
        app.use(errorHandler);

        const response = await request(app).get('/boom');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal Server Error');
        expect(response.body.message).toBe('Internal Server Error');
        expect(response.body.errorId).toBe('error-id-123');
        expect(response.body.stack).toBeUndefined();
    });

    test('uses warn path for non-500 errors and omits errorId', async () => {
        const app = express();
        app.get('/bad', (req, res, next) => {
            const err = new Error('bad request');
            err.statusCode = 400;
            next(err);
        });
        app.use(errorHandler);

        const response = await request(app).get('/bad');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('bad request');
        expect(response.body.message).toBe('bad request');
        expect(response.body.errorId).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).not.toHaveBeenCalled();
    });
});
