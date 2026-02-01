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

const db = require('../../config/database');
const request = require('supertest');
const express = require('express');
const apiKeysRouter = require('../../routes/apiKeys');
const librariesRouter = require('../../routes/libraries');
const { authenticateTokenOrApiKey, requireReadWrite } = require('../../middleware/apiKeyAuth');
const authService = require('../../services/auth');

// Create test app for API key management
const app = express();
app.use(express.json());
app.use('/api/keys', apiKeysRouter);

// Create test app for protected routes
const protectedApp = express();
protectedApp.use(express.json());
protectedApp.use('/api/libraries', authenticateTokenOrApiKey, librariesRouter);

describe('API Keys Integration Tests', () => {
    let testUserId;
    let testToken;
    let testApiKeyId;
    let testApiKey;
    let testReadOnlyKeyId;
    let testReadOnlyKey;

    // Setup test user and JWT token
    beforeAll(async () => {
        // Create a test user
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('testuser', 'hashedpass', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        // Generate a test JWT token
        testToken = await authService.generateToken({ 
            id: testUserId, 
            username: 'testuser',
            role: 'admin'
        });
    });

    // Clean up after all tests
    afterAll(async () => {
        // Delete test API keys
        await db.query('DELETE FROM api_keys WHERE id = $1 OR id = $2', [testApiKeyId, testReadOnlyKeyId]);
        // Delete test user
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
            
            // Clean up
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

            // Clean up
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
            expect(testKey).not.toHaveProperty('key'); // Full key should not be in list
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

            // Re-activate for other tests
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
            // Create a temporary key to delete
            const createResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Temporary Key',
                    permissions: 'read_write'
                })
                .expect(200);

            const tempKeyId = createResponse.body.id;

            // Delete it
            await request(app)
                .delete(`/api/keys/${tempKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            // Verify it's gone
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
        let testLibraryId;

        beforeAll(async () => {
            // Create test media server and library for authentication tests
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
            testLibraryId = libraryResult.rows[0].id;
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
            // Deactivate the key
            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: false })
                .expect(200);

            // Try to use it
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testApiKey)
                .expect(401);

            // Re-activate it
            await request(app)
                .patch(`/api/keys/${testApiKeyId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: true })
                .expect(200);
        });

        test('should track last used timestamp and IP', async () => {
            // Use the key
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', testApiKey)
                .expect(200);

            // Small delay to ensure timestamp is updated
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check last used was updated
            const keyInfo = await db.query(
                'SELECT last_used_at, last_used_ip FROM api_keys WHERE id = $1',
                [testApiKeyId]
            );

            expect(keyInfo.rows[0].last_used_at).not.toBeNull();
            expect(keyInfo.rows[0].last_used_ip).not.toBeNull();
        });

        test('should fail with expired API key', async () => {
            // Create an expired key
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 1);

            const createResponse = await request(app)
                .post('/api/keys')
                .set('Authorization', `Bearer ${testToken}`)
                .send({
                    name: 'Expired Key',
                    permissions: 'read_write',
                    expires_at: pastDate.toISOString()
                })
                .expect(200);

            const expiredKey = createResponse.body.key;

            // Try to use expired key
            await request(protectedApp)
                .get('/api/libraries')
                .set('X-API-Key', expiredKey)
                .expect(401);

            // Clean up
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
            // Note: This will fail if library doesn't exist, but should not fail on permission
            const response = await request(protectedApp)
                .post('/api/libraries/999999/sync')
                .set('X-API-Key', testApiKey)
                .send({});

            // Should get 404 (not found) or 500 (error), not 403 (forbidden)
            expect(response.status).not.toBe(403);
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
            
            // Make 21 requests (limit is 20 per 15 minutes)
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
            
            // At least one should be rate limited
            const rateLimited = responses.some(r => r.status === 429);
            expect(rateLimited).toBe(true);

            // Clean up created keys
            const createdIds = responses
                .filter(r => r.status === 200)
                .map(r => r.body.id);
            
            if (createdIds.length > 0) {
                await db.query(
                    'DELETE FROM api_keys WHERE id = ANY($1)',
                    [createdIds]
                );
            }
        }, 30000); // Increase timeout for this test
    });
});
