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

const request = require('supertest');
const express = require('express');
const plexOAuthRouter = require('../../routes/plexOAuth');
const db = require('../../config/database');

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
    authenticateToken: (req, res, next) => next()
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/plex', plexOAuthRouter);

describe('POST /api/plex/save-server', () => {
    let testServerId;

    beforeEach(async () => {
        // Clean up any existing test servers
        await db.query("DELETE FROM media_server WHERE type = 'plex'");
    });

    afterEach(async () => {
        // Clean up test data
        if (testServerId) {
            await db.query('DELETE FROM media_server WHERE id = $1', [testServerId]);
            testServerId = null;
        }
    });

    afterAll(async () => {
        // Final cleanup - ensure no test servers remain
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

        // Verify only one server exists
        const result = await db.query("SELECT COUNT(*) FROM media_server WHERE type = 'plex'");
        expect(parseInt(result.rows[0].count)).toBe(1);
    });

    test('should UPDATE existing server instead of creating duplicate', async () => {
        // First connection
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Plex Server',
                url: 'http://localhost:32400',
                token: 'test-token-123'
            });

        const firstServerId = firstResponse.body.server.id;

        // Second connection with same URL (simulating OAuth reconnect)
        const secondResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Plex Server Updated',
                url: 'http://localhost:32400',
                token: 'test-token-456'
            });

        expect(secondResponse.status).toBe(200);
        expect(secondResponse.body.success).toBe(true);
        
        // Should be the SAME server ID (updated, not inserted)
        expect(secondResponse.body.server.id).toBe(firstServerId);
        expect(secondResponse.body.server.name).toBe('Test Plex Server Updated');

        testServerId = firstServerId;

        // Verify still only one server exists
        const result = await db.query("SELECT COUNT(*) FROM media_server WHERE type = 'plex'");
        expect(parseInt(result.rows[0].count)).toBe(1);
    });

    test('should return 400 if required fields are missing', async () => {
        const response = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Test Server'
                // Missing url and token
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('name, url, and token are required');
    });

    test('should deactivate other servers when creating new server', async () => {
        // Create first server with different URL
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'First Server',
                url: 'http://localhost:32401',
                token: 'token-1'
            });

        const firstServerId = firstResponse.body.server.id;

        // Create second server with different URL
        const secondResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Second Server',
                url: 'http://localhost:32402',
                token: 'token-2'
            });

        const secondServerId = secondResponse.body.server.id;

        // Verify first server is now inactive
        const firstServerCheck = await db.query(
            'SELECT is_active FROM media_server WHERE id = $1',
            [firstServerId]
        );
        expect(firstServerCheck.rows[0].is_active).toBe(false);

        // Verify second server is active
        const secondServerCheck = await db.query(
            'SELECT is_active FROM media_server WHERE id = $1',
            [secondServerId]
        );
        expect(secondServerCheck.rows[0].is_active).toBe(true);

        // Clean up
        await db.query('DELETE FROM media_server WHERE id IN ($1, $2)', [firstServerId, secondServerId]);
    });

    test('should update server and keep it active on reconnect', async () => {
        // First connection
        const firstResponse = await request(app)
            .post('/api/plex/save-server')
            .send({
                name: 'Original Name',
                url: 'http://localhost:32400',
                token: 'original-token'
            });

        const serverId = firstResponse.body.server.id;

        // Reconnect with updated name and token
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

        // Verify the token was updated in database
        const serverCheck = await db.query(
            'SELECT api_key FROM media_server WHERE id = $1',
            [serverId]
        );
        expect(serverCheck.rows[0].api_key).toBe('updated-token');

        testServerId = serverId;
    });
});
