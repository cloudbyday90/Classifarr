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
import consoleHelpers from '../setup/consoleHelpers.mjs';
import { createLibrariesRouteTestDeps } from '../setup/createLibrariesRouteTestDeps.mjs';
import { createIntegrationDatabaseModuleMock } from './setup.mjs';
import { createLibrariesRouter } from '../../routes/librariesRouteShared.mjs';

const { withConsoleSpy } = consoleHelpers;

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { default: apiKeysRouter } = await import('../../routes/apiKeys.mjs');
const { default: radarrService } = await import('../../services/radarr.mjs');
const { default: sonarrService } = await import('../../services/sonarr.mjs');
const { default: ollamaService } = await import('../../services/ollama.mjs');
const { default: mediaPatternAnalyzer } = await import('../../services/mediaPatternAnalyzer.mjs');
const { default: libraryProfileService } = await import('../../services/libraryProfileService.mjs');
const { default: mediaSyncService } = await import('../../services/mediaSync.mjs');
const loggerModule = await import('../../utils/logger.mjs');
const metadataNormalization = await import('../../utils/metadataNormalization.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateTokenOrApiKey, requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');
const { default: metadataEnrichment } = await import('../../utils/metadataEnrichment.mjs');
const { default: errors } = await import('../../utils/errors.mjs');

const { createLogger } = loggerModule.default;
const { normalizeMetadataListLower } = metadataNormalization;

let protectedApp;

describe('API Keys Integration Tests', () => {
    let app;
    let testUserId;
    let testToken;
    let testApiKeyId;
    let testApiKey;
    let testReadOnlyKeyId;
    let testReadOnlyKey;
    let testEmbeddingServiceKeyId;
    let testEmbeddingServiceKey;

    beforeAll(async () => {
        app = express();
        app.set('trust proxy', 1);
        app.use(express.json());
        app.use('/api/keys', apiKeysRouter);

        protectedApp = express();
        protectedApp.set('trust proxy', 1);
        protectedApp.use(express.json());
        protectedApp.use(
            '/api/libraries',
            authenticateTokenOrApiKey,
            createLibrariesRouter(
                createLibrariesRouteTestDeps({
                    express,
                    db,
                    radarrService,
                    sonarrService,
                    ollamaService,
                    mediaPatternAnalyzer,
                    libraryProfileService,
                    createLogger,
                    normalizeMetadataListLower,
                    authenticateTokenOrApiKey,
                    requireReadWrite,
                    mediaSyncService,
                    metadataEnrichment,
                    errors,
                })
            )
        );

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('testuser', 'hashedpass', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'testuser',
            role: 'admin'
        });
    });

    afterAll(async () => {
        await db.query('DELETE FROM api_keys WHERE id = ANY($1)', [[
            testApiKeyId,
            testReadOnlyKeyId,
            testEmbeddingServiceKeyId,
        ].filter(Boolean)]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    describe('POST /api/keys - Create API Key', () => {
        test('should create a new API key with read_write permissions', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test Integration Key',
                    permissions: 'read_write'
                })
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body).toHaveProperty('key');
            expect(response.body).toHaveProperty('key_prefix');
            expect(response.body.name).toBe('Test Integration Key');
            expect(response.body.permissions).toBe('read_write');
            expect(response.body.key).toMatch(/^clf_[A-Za-z0-9_-]{32}$/);
            expect(response.body.key_prefix).toBe(response.body.key.substring(0, 8));
            expect(response.body.is_active).toBe(true);

            testApiKeyId = response.body.id;
            testApiKey = response.body.key;
        });

        test('should create a new API key with read_only permissions', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test Read-Only Key',
                    permissions: 'read_only'
                })
                .expect(200);

            expect(response.body.permissions).toBe('read_only');
            testReadOnlyKeyId = response.body.id;
            testReadOnlyKey = response.body.key;
        });

        test('should create a new API key with webhook_only permissions', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test Webhook-Only Key',
                    permissions: 'webhook_only'
                })
                .expect(200);

            expect(response.body.permissions).toBe('webhook_only');
            await db.query('DELETE FROM api_keys WHERE id = $1', [response.body.id]);
        });

        test('should create a new API key with admin permissions', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Test Admin Key',
                    permissions: 'admin'
                })
                .expect(200);

            expect(response.body.permissions).toBe('admin');
            await db.query('DELETE FROM api_keys WHERE id = $1', [response.body.id]);
        });

        test('should create a new API key with embed_service permissions', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Embedding Service Key',
                    permissions: 'embed_service'
                })
                .expect(200);

            expect(response.body.permissions).toBe('embed_service');
            testEmbeddingServiceKeyId = response.body.id;
            testEmbeddingServiceKey = response.body.key;
        });

        test('should create API key with expiration date', async () => {
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + 30);

            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Expiring Key',
                    permissions: 'read_write',
                    expires_at: futureDate.toISOString()
                })
                .expect(200);

            expect(response.body.expires_at).toBeDefined();
            await db.query('DELETE FROM api_keys WHERE id = $1', [response.body.id]);
        });

        test('should fail without authentication', async () => {
            await request(app)
                .post('/api/keys')
                .send({
                    name: 'Unauthorized Key',
                    permissions: 'read_write'
                })
                .expect(401);
        });

        test('should fail with invalid permissions', async () => {
            await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Invalid Permissions Key',
                    permissions: 'invalid_permission'
                })
                .expect(400);
        });

        test('should use default values when not provided', async () => {
            const response = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({})
                .expect(200);

            expect(response.body.name).toBe('API Key');
            expect(response.body.permissions).toBe('read_write');
            await db.query('DELETE FROM api_keys WHERE id = $1', [response.body.id]);
        });
    });

    describe('GET /api/keys - List API Keys', () => {
        test('should list all API keys', async () => {
            const response = await request(app)
                .get('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);

            const testKey = response.body.find(k => k.id === testApiKeyId);
            expect(testKey).toBeDefined();
            expect(testKey.name).toBe('Test Integration Key');
            expect(testKey.key_prefix).toBeDefined();
            expect(testKey).not.toHaveProperty('key');
            expect(testKey).not.toHaveProperty('key_hash');
        });

        test('should fail without authentication', async () => {
            await request(app)
                .get('/api/keys')
                .expect(401);
        });
    });

    describe('GET /api/keys/:id/reveal - Reveal Full API Key', () => {
        test('should reveal the full API key for authenticated user', async () => {
            const response = await request(app)
                .get(`/api/keys/${testApiKeyId}/reveal`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('key');
            expect(response.body.key).toBe(testApiKey);
            expect(response.body.id).toBe(testApiKeyId);
            expect(response.body.name).toBe('Test Integration Key');
        });

        test('should fail for non-existent key', async () => {
            await request(app)
                .get('/api/keys/999999/reveal')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);
        });

        test('should fail without authentication', async () => {
            await request(app)
                .get(`/api/keys/${testApiKeyId}/reveal`)
                .expect(401);
        });
    });

    describe('PATCH /api/keys/:id - Update API Key', () => {
        test('should update API key name', async () => {
            const response = await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Updated Integration Key' })
                .expect(200);

            expect(response.body.name).toBe('Updated Integration Key');
            expect(response.body.id).toBe(testApiKeyId);
        });

        test('should update API key active status', async () => {
            const response = await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: false })
                .expect(200);

            expect(response.body.is_active).toBe(false);

            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: true })
                .expect(200);
        });

        test('should fail without valid update fields', async () => {
            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({})
                .expect(400);
        });

        test('should fail for non-existent key', async () => {
            await request(app)
                .patch('/api/keys/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Non-existent' })
                .expect(404);
        });
    });

    describe('DELETE /api/keys/:id - Revoke API Key', () => {
        test('should delete an API key', async () => {
            const createResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Temporary Key',
                    permissions: 'read_write'
                })
                .expect(200);

            const tempKeyId = createResponse.body.id;

            await request(app)
                .delete(`/api/keys/${tempKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const listResponse = await request(app)
                .get('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const deletedKey = listResponse.body.find(k => k.id === tempKeyId);
            expect(deletedKey).toBeUndefined();
        });

        test('should fail for non-existent key', async () => {
            await request(app)
                .delete('/api/keys/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);
        });
    });

    describe('API Key Authentication', () => {
        let testMediaServerId;
        let _testLibraryId;

        beforeAll(async () => {
            const mediaServerResult = await db.query(`
                INSERT INTO media_server (name, type, url, api_key, is_active)
                VALUES ('Test Server', 'plex', 'http://localhost:32400', 'test-key', true)
                RETURNING id
            `);
            testMediaServerId = mediaServerResult.rows[0].id;

            const libraryResult = await db.query(`
                INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
                VALUES ($1, 'test-lib-1', 'Test Library', 'movie', true, 5)
                RETURNING id
            `, [testMediaServerId]);
            _testLibraryId = libraryResult.rows[0].id;
        });

        afterAll(async () => {
            await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        });

        test('should authenticate with valid API key', async () => {
            const response = await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testApiKey)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
        });

        test('should fail with invalid API key', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', 'clf_invalidkey123456789012345678901')
                .expect(401);
        });

        test('should fail with inactive API key', async () => {
            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: false })
                .expect(200);

            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testApiKey)
                .expect(401);

            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: true })
                .expect(200);
        });

        test('should track last used timestamp and IP', async () => {
            await db.query('DELETE FROM api_key_audit WHERE api_key_id = $1', [testApiKeyId]);

            const forwardedIp = '10.24.1.7';
            const userAgent = 'api-key-integration-test/1.0';

            await request(protectedApp)
                .get('/api/libraries')
                .set('X-Forwarded-For', forwardedIp)
                .set('User-Agent', userAgent)
                .set('X-API-Key', testApiKey)
                .expect(200);

            const keyInfo = await db.query(
                'SELECT last_used_at, host(last_used_ip) AS last_used_ip FROM api_keys WHERE id = $1',
                [testApiKeyId]
            );

            const auditInfo = await db.query(
                `SELECT action, endpoint, host(ip_address) AS ip_address, user_agent
                 FROM api_key_audit
                 WHERE api_key_id = $1
                 ORDER BY id DESC
                 LIMIT 1`,
                [testApiKeyId]
            );

            expect(keyInfo.rows[0].last_used_at).not.toBeNull();
            expect(keyInfo.rows[0].last_used_ip).toBe(forwardedIp);
            expect(auditInfo.rows[0]).toMatchObject({
                action: 'used',
                endpoint: '/api/libraries',
                ip_address: forwardedIp,
                user_agent: userAgent,
            });
        });

        test('should fail with expired API key', async () => {
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const createResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .set('X-Forwarded-For', '10.99.0.55')
                .send({
                    name: 'Expired Key',
                    permissions: 'read_write',
                    expires_at: pastDate.toISOString()
                })
                .expect(200);

            const expiredKey = createResponse.body.key;

            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', expiredKey)
                .expect(401);

            await db.query('DELETE FROM api_keys WHERE id = $1', [createResponse.body.id]);
        });
    });

    describe('Permission Enforcement', () => {
        test('read_only key should access GET endpoints', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testReadOnlyKey)
                .expect(200);
        });

        test('read_only key should be denied on POST endpoints', async () => {
            await request(protectedApp)
                .post('/api/libraries/1/sync')
                .set('X-API-Key', testReadOnlyKey)
                .send({})
                .expect(403);
        });

        test('read_write key should access POST endpoints', async () => {
            await withConsoleSpy('warn', { suppress: true }, async ({ getMessages }) => {
                const response = await request(protectedApp)
                    .post('/api/libraries/999999/sync')
                    .set('X-API-Key', testApiKey)
                    .send({});

                expect(response.status).not.toBe(403);
                expect(getMessages()).toContain('Library not found during sync');
            });
        });

        test('embed_service key should be denied on GET endpoints', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testEmbeddingServiceKey)
                .expect(403);
        });
    });

    describe('Dual Authentication', () => {
        test('should accept JWT token', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);
        });

        test('should accept API key', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testApiKey)
                .expect(200);
        });

        test('should fail without any authentication', async () => {
            await request(protectedApp)
                .get('/api/libraries')
                .expect(401);
        });
    });

    describe('Rate Limiting', () => {
        test('should enforce rate limits on key creation', async () => {
            const requests = [];

            for (let i = 0; i < 21; i++) {
                requests.push(
                    request(app)
                        .post('/api/keys')
                        .set('Authorization', `Bearer ${testToken}`)
                        .send({
                            name: `Rate Limit Test Key ${i}`,
                            permissions: 'read_write'
                        })
                );
            }

            const responses = await Promise.all(requests);
            const rateLimited = responses.some(r => r.status === 429);
            expect(rateLimited).toBe(true);

            const createdIds = responses
                .filter(r => r.status === 200)
                .map(r => r.body.id);

            if (createdIds.length > 0) {
                await db.query('DELETE FROM api_keys WHERE id = ANY($1)', [createdIds]);
            }
        }, 30000);
    });
});
