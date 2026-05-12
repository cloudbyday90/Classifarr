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
import request from 'supertest';
import express from 'express';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';

import { createPassThroughAuthMock } from '../helpers/mockFactory.mjs';
jest.unstable_mockModule('../../middleware/auth.mjs', () => createPassThroughAuthMock());

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { plexOAuthService: plexOAuth } = await import('../../services/plexOAuth.mjs');
const { createPlexOAuthRouter } = await import('../../routes/plexOAuthRouteShared.mjs');

describe('POST /api/plex/save-server', () => {
    let testServerId;
    const authenticateToken = (_req, _res, next) => next();
    const logger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    };

    const app = express();
    app.use(express.json());
    app.use('/api/plex', createPlexOAuthRouter({
        express,
        plexOAuth,
        db,
        authenticateToken,
        logger,
    }));

    beforeEach(async () => {
        await db.query("DELETE FROM media_server WHERE type = 'plex'");
    });

    afterEach(async () => {
        if (testServerId) {
            await db.query('DELETE FROM media_server WHERE id = $1', [testServerId]);
            testServerId = null;
        }
    });

    afterAll(async () => {
        await db.query("DELETE FROM media_server WHERE type = 'plex' AND url LIKE '%localhost%'");
    });

    test('should create new server on first connection', async () => {
        const response = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Plex Server',
                url: 'http://localhost:32400',
                token: 'test-token-123'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.server).toHaveProperty('id');
        expect(response.body.server.name).toBe('Test Plex Server');
        expect(response.body.server.is_active).toBe(true);

        testServerId = response.body.server.id;

        const result = await db.query("SELECT COUNT(*) FROM media_server WHERE type = 'plex'");
        expect(parseInt(result.rows[0].count)).toBe(1);
    });

    test('should UPDATE existing server instead of creating duplicate', async () => {
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Plex Server',
                url: 'http://localhost:32400',
                token: 'test-token-123'
            });

        const firstServerId = firstResponse.body.server.id;

        const secondResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Plex Server Updated',
                url: 'http://localhost:32400',
                token: 'test-token-456'
            });

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.success).toBe(true);
        
        expect(secondResponse.body.server.id).toBe(firstServerId);
        expect(secondResponse.body.server.name).toBe('Test Plex Server Updated');

        testServerId = firstServerId;

        const result = await db.query("SELECT COUNT(*) FROM media_server WHERE type = 'plex'");
        expect(parseInt(result.rows[0].count)).toBe(1);
    });

    test('should return 400 if required fields are missing', async () => {
        const response = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Server'
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('name, url, and token are required');
    });

    test('should deactivate other servers when creating new server', async () => {
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'First Server',
                url: 'http://localhost:32401',
                token: 'token-1'
            });

        const firstServerId = firstResponse.body.server.id;

        const secondResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Second Server',
                url: 'http://localhost:32402',
                token: 'token-2'
            });

        const secondServerId = secondResponse.body.server.id;

        const firstServerCheck = await db.query(
            'SELECT is_active FROM media_server WHERE id = $1',
            [firstServerId]
        );
        expect(firstServerCheck.rows[0].is_active).toBe(false);

        const secondServerCheck = await db.query(
            'SELECT is_active FROM media_server WHERE id = $1',
            [secondServerId]
        );
        expect(secondServerCheck.rows[0].is_active).toBe(true);

        await db.query('DELETE FROM media_server WHERE id IN ($1, $2)', [firstServerId, secondServerId]);
    });

    test('should update server and keep it active on reconnect', async () => {
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Original Name',
                url: 'http://localhost:32400',
                token: 'original-token'
            });

        const serverId = firstResponse.body.server.id;

        const secondResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Updated Name',
                url: 'http://localhost:32400',
                token: 'updated-token'
            });

        expect(secondResponse.body.server.id).toBe(serverId);
        expect(secondResponse.body.server.name).toBe('Updated Name');
        expect(secondResponse.body.server.is_active).toBe(true);

        const serverCheck = await db.query(
            'SELECT api_key FROM media_server WHERE id = $1',
            [serverId]
        );
        expect(serverCheck.rows[0].api_key).toBe('updated-token');

        testServerId = serverId;
    });
});
