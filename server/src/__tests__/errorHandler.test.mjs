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

const { errorHandler } = await import('../middleware/errorHandler.mjs');
const {
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    ConflictError,
    ServiceUnavailableError,
} = await import('../utils/appError.mjs');

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

    describe('AppError subclasses with toJSON (statusCode < 500)', () => {
        test('returns 400 with toJSON for ValidationError', async () => {
            const app = express();
            app.get('/validate', (req, res, next) => {
                next(new ValidationError('Invalid input'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/validate');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Invalid input' });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('returns 401 with toJSON for AuthenticationError', async () => {
            const app = express();
            app.get('/auth', (req, res, next) => {
                next(new AuthenticationError('Invalid credentials'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/auth');

            expect(response.status).toBe(401);
            expect(response.body).toEqual({ error: 'Invalid credentials' });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        test('returns 403 with toJSON for ForbiddenError', async () => {
            const app = express();
            app.get('/forbidden', (req, res, next) => {
                next(new ForbiddenError('Access denied'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/forbidden');

            expect(response.status).toBe(403);
            expect(response.body).toEqual({ error: 'Access denied' });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        test('returns 404 with toJSON for NotFoundError', async () => {
            const app = express();
            app.get('/missing', (req, res, next) => {
                next(new NotFoundError('Resource not found'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/missing');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Resource not found' });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        test('returns 409 with toJSON for ConflictError including extra fields', async () => {
            const app = express();
            app.get('/conflict', (req, res, next) => {
                next(new ConflictError('Already running', { runId: 42 }));
            });
            app.use(errorHandler);

            const response = await request(app).get('/conflict');

            expect(response.status).toBe(409);
            expect(response.body).toEqual({ error: 'Already running', runId: 42 });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
        });

        test('includes code in toJSON when provided', async () => {
            const app = express();
            app.get('/coded', (req, res, next) => {
                next(new ValidationError('Bad value', { code: 'INVALID_FORMAT' }));
            });
            app.use(errorHandler);

            const response = await request(app).get('/coded');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ error: 'Bad value', code: 'INVALID_FORMAT' });
        });
    });

    describe('operational errors (isOperational, any statusCode)', () => {
        test('returns 503 with exposed message for ServiceUnavailableError', async () => {
            const app = express();
            app.get('/unavail', (req, res, next) => {
                next(new ServiceUnavailableError('TMDB API key not configured'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/unavail');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({ error: 'TMDB API key not configured' });
            expect(response.body.errorId).toBeUndefined();
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).not.toHaveBeenCalled();
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        test('exposes ServiceUnavailableError message in production', async () => {
            process.env.NODE_ENV = 'production';

            const app = express();
            app.get('/unavail', (req, res, next) => {
                next(new ServiceUnavailableError('No bot token configured'));
            });
            app.use(errorHandler);

            const response = await request(app).get('/unavail');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({ error: 'No bot token configured' });
            expect(response.body.message).toBeUndefined();
            expect(response.body.errorId).toBeUndefined();
            expect(response.body.stack).toBeUndefined();
        });

        test('returns 503 with toJSON including extra fields', async () => {
            const app = express();
            app.get('/unavail', (req, res, next) => {
                next(new ServiceUnavailableError('Provider in cooldown', { retryAfter: '2026-05-26T19:00:00Z' }));
            });
            app.use(errorHandler);

            const response = await request(app).get('/unavail');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({ error: 'Provider in cooldown', retryAfter: '2026-05-26T19:00:00Z' });
        });

        test('uses fallback format for operational error without toJSON', async () => {
            const err = new Error('feature disabled');
            err.isOperational = true;
            err.statusCode = 503;

            const app = express();
            app.get('/disabled', (req, res, next) => {
                next(err);
            });
            app.use(errorHandler);

            const response = await request(app).get('/disabled');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({ error: 'feature disabled' });
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        test('includes code in fallback format for operational error without toJSON', async () => {
            const err = new Error('rate limited');
            err.isOperational = true;
            err.statusCode = 503;
            err.code = 'RATE_LIMITED';

            const app = express();
            app.get('/rated', (req, res, next) => {
                next(err);
            });
            app.use(errorHandler);

            const response = await request(app).get('/rated');

            expect(response.status).toBe(503);
            expect(response.body).toEqual({ error: 'rate limited', code: 'RATE_LIMITED' });
        });
    });
});
