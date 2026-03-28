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

const express = require('express');
const request = require('supertest');

const mockLogger = {
    error: jest.fn().mockResolvedValue('error-id-123'),
    warn: jest.fn().mockResolvedValue('warn-id-123'),
    info: jest.fn(),
    debug: jest.fn()
};

jest.mock('../utils/logger', () => ({
    createLogger: jest.fn(() => mockLogger)
}));

const errorHandler = require('../middleware/errorHandler');

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
