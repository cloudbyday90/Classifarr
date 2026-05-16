/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import {
  createLoggerModuleMock,
  createMountedTestApp,
} from './helpers/setupRouteTest.mjs';
import {
  createNamedMockModule,
  createPassThroughAuthMock,
} from './helpers/mockFactory.mjs';

const mockDatabase = {
    pool: {
        connect: jest.fn(),
    },
    withTransaction: jest.fn(async (fn) => {
        const conn = await mockDatabase.pool.connect();
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
jest.unstable_mockModule('../config/database.mjs', () => createNamedMockModule('pool', mockDatabase));

jest.unstable_mockModule('../middleware/auth.mjs', () => createPassThroughAuthMock());

const mockEmbyAuth = {
    authenticateWithPassword: jest.fn(),
    getServerInfo: jest.fn(),
    testConnection: jest.fn(),
    verifyToken: jest.fn(),
};
jest.unstable_mockModule('../services/embyAuth.mjs', () => createNamedMockModule('embyAuthService', mockEmbyAuth));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const db = mockDatabase;
const embyAuth = mockEmbyAuth;
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const authenticateToken = (_req, _res, next) => next();

describe('emby auth routes', () => {
    let app;
    let client;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { createEmbyAuthRouter } = await import('../routes/embyAuthRouteShared.mjs');
        client = {
            query: jest.fn(),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(client);
        app = createMountedTestApp({
            basePath: '/api/emby',
            router: createEmbyAuthRouter({
                express,
                embyAuth,
                db,
                authenticateToken,
                logger,
            }),
        });
    });

    test('POST /api/emby/test validates serverUrl', async () => {
        const response = await request(app)
            .post('/api/emby/test')
            .send({})
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl is required/i);
        expect(embyAuth.testConnection).not.toHaveBeenCalled();
    });

    test('POST /api/emby/authenticate requires username', async () => {
        const response = await request(app)
            .post('/api/emby/authenticate')
            .send({ serverUrl: 'http://emby.local' })
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl and username are required/i);
        expect(embyAuth.authenticateWithPassword).not.toHaveBeenCalled();
    });

    test('POST /api/emby/verify requires token', async () => {
        const response = await request(app)
            .post('/api/emby/verify')
            .send({ serverUrl: 'http://emby.local' })
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl and token are required/i);
        expect(embyAuth.verifyToken).not.toHaveBeenCalled();
    });

    test('POST /api/emby/verify returns service result', async () => {
        embyAuth.verifyToken.mockResolvedValueOnce({ valid: true });

        const response = await request(app)
            .post('/api/emby/verify')
            .send({ serverUrl: 'http://emby.local', token: 'token-1' })
            .expect(200);

        expect(response.body).toEqual({ valid: true });
        expect(embyAuth.verifyToken).toHaveBeenCalledWith('http://emby.local', 'token-1');
    });

    test('POST /api/emby/save saves server configuration', async () => {
        embyAuth.getServerInfo.mockResolvedValueOnce({ success: true, serverName: 'Emby Server' });
        client.query
            .mockResolvedValueOnce()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce({
                rows: [{ id: 1, type: 'emby', name: 'Emby Server', url: 'http://emby.local', is_active: true }],
            })
            .mockResolvedValueOnce();

        const response = await request(app)
            .post('/api/emby/save')
            .send({ serverUrl: 'http://emby.local', token: 'token-1' })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith('UPDATE media_server SET is_active = false');
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});
