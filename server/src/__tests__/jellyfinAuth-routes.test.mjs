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

const mockDatabase = {
    pool: {
        connect: jest.fn(),
    },
};
jest.unstable_mockModule('../config/database.mjs', () => ({ ...mockDatabase, default: mockDatabase }));

const mockAuth = {
    authenticateToken: (_req, _res, next) => next(),
};
jest.unstable_mockModule('../middleware/auth.mjs', () => ({ ...mockAuth, default: mockAuth }));

const mockJellyfinAuth = {
    authenticateWithPassword: jest.fn(),
    authenticateWithQuickConnect: jest.fn(),
    checkQuickConnect: jest.fn(),
    getServerInfo: jest.fn(),
    initiateQuickConnect: jest.fn(),
    isQuickConnectEnabled: jest.fn(),
    testConnection: jest.fn(),
};
jest.unstable_mockModule('../services/jellyfinAuth.mjs', () => ({ ...mockJellyfinAuth, default: mockJellyfinAuth }));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
    createLogger: () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    }),
}));

const db = mockDatabase;
const jellyfinAuth = mockJellyfinAuth;
const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};
const authenticateToken = (_req, _res, next) => next();

describe('jellyfin auth routes', () => {
    let app;
    let client;

    beforeEach(async () => {
        jest.clearAllMocks();
        const { createJellyfinAuthRouter } = await import('../routes/jellyfinAuthRouteShared.mjs');
        client = {
            query: jest.fn(),
            release: jest.fn(),
        };
        db.pool.connect.mockResolvedValue(client);
        app = express();
        app.use(express.json());
        app.use('/api/jellyfin', createJellyfinAuthRouter({
            express,
            jellyfinAuth,
            db,
            authenticateToken,
            logger,
        }));
    });

    test('POST /api/jellyfin/test validates serverUrl', async () => {
        const response = await request(app)
            .post('/api/jellyfin/test')
            .send({})
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl is required/i);
        expect(jellyfinAuth.testConnection).not.toHaveBeenCalled();
    });

    test('POST /api/jellyfin/test returns service result', async () => {
        jellyfinAuth.testConnection.mockResolvedValueOnce({ success: true });

        const response = await request(app)
            .post('/api/jellyfin/test')
            .send({ serverUrl: 'http://jellyfin.local' })
            .expect(200);

        expect(response.body).toEqual({ success: true });
        expect(jellyfinAuth.testConnection).toHaveBeenCalledWith('http://jellyfin.local');
    });

    test('POST /api/jellyfin/quick-connect/check requires secret', async () => {
        const response = await request(app)
            .post('/api/jellyfin/quick-connect/check')
            .send({ serverUrl: 'http://jellyfin.local' })
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl and secret are required/i);
        expect(jellyfinAuth.checkQuickConnect).not.toHaveBeenCalled();
    });

    test('POST /api/jellyfin/authenticate requires username', async () => {
        const response = await request(app)
            .post('/api/jellyfin/authenticate')
            .send({ serverUrl: 'http://jellyfin.local' })
            .expect(400);

        expect(response.body.error).toMatch(/serverUrl and username are required/i);
        expect(jellyfinAuth.authenticateWithPassword).not.toHaveBeenCalled();
    });

    test('POST /api/jellyfin/save saves server configuration', async () => {
        jellyfinAuth.getServerInfo.mockResolvedValueOnce({ success: true, serverName: 'JF Server' });
        client.query
            .mockResolvedValueOnce()
            .mockResolvedValueOnce()
            .mockResolvedValueOnce({
                rows: [{ id: 1, type: 'jellyfin', name: 'JF Server', url: 'http://jellyfin.local', is_active: true }],
            })
            .mockResolvedValueOnce();

        const response = await request(app)
            .post('/api/jellyfin/save')
            .send({ serverUrl: 'http://jellyfin.local', token: 'token-1' })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(client.query).toHaveBeenCalledWith('BEGIN');
        expect(client.query).toHaveBeenCalledWith('UPDATE media_server SET is_active = false');
        expect(client.query).toHaveBeenCalledWith('COMMIT');
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});
