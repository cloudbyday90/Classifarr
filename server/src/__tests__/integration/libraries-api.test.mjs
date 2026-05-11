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

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { createLibrariesRouter } = await import('../../routes/librariesRouteShared.mjs');

const radarrService = {};
const sonarrService = {};
const mediaSyncService = {};
const ollamaService = {};
const mediaPatternAnalyzer = {};
const libraryProfileService = {};
const createLogger = () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
});
const normalizeMetadataListLower = (value) => value;
const metadataEnrichment = {};
const errors = {};
const app = express();
app.use(express.json());
app.use('/api/libraries', createLibrariesRouter({
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
}));

function authenticateTokenOrApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader === 'Bearer integration-test-token') {
        req.user = { id: 1, role: 'admin' };
        next();
        return;
    }

    res.status(401).json({ error: 'Authentication required' });
}

function requireReadWrite(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }

    next();
}

describe('Libraries API Integration Tests', () => {
    let testUserId;
    let testToken;
    let testMediaServerId;
    let testLibraryId;
    let testTvLibraryId;

    beforeAll(async () => {
        // Create a test user and JWT token
        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('libtest_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;
        testToken = 'integration-test-token';

        // Create a test media server
        const serverResult = await db.query(`
            INSERT INTO media_server (name, type, url, api_key, is_active)
            VALUES ('Test Plex', 'plex', 'http://localhost:32400', 'plex-testkey', true)
            RETURNING id
        `);
        testMediaServerId = serverResult.rows[0].id;

        // Create a movie library
        const libResult = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
            VALUES ($1, 'ext-lib-movies', 'Movies', 'movie', true, 5)
            RETURNING id
        `, [testMediaServerId]);
        testLibraryId = libResult.rows[0].id;

        // Create a TV library
        const tvResult = await db.query(`
            INSERT INTO libraries (media_server_id, external_id, name, media_type, is_active, priority)
            VALUES ($1, 'ext-lib-tv', 'TV Shows', 'tv', true, 3)
            RETURNING id
        `, [testMediaServerId]);
        testTvLibraryId = tvResult.rows[0].id;
    });

    afterAll(async () => {
        await db.query('DELETE FROM library_labels WHERE library_id IN ($1, $2)', [testLibraryId, testTvLibraryId]);
        await db.query('DELETE FROM libraries WHERE id IN ($1, $2)', [testLibraryId, testTvLibraryId]);
        await db.query('DELETE FROM media_server WHERE id = $1', [testMediaServerId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    // ============================================================
    // GET /api/libraries
    // ============================================================
    describe('GET /api/libraries', () => {
        test('should return all libraries with item counts', async () => {
            const response = await request(app)
                .get('/api/libraries')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);

            const lib = response.body.find(l => l.id === testLibraryId);
            expect(lib).toBeDefined();
            expect(lib.name).toBe('Movies');
            expect(lib.media_type).toBe('movie');
            expect(lib).toHaveProperty('item_count');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get('/api/libraries')
                .expect(401);
        });

        test('should include both movie and TV libraries', async () => {
            const response = await request(app)
                .get('/api/libraries')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            const movieLib = response.body.find(l => l.id === testLibraryId);
            const tvLib = response.body.find(l => l.id === testTvLibraryId);
            expect(movieLib).toBeDefined();
            expect(tvLib).toBeDefined();
        });
    });

    // ============================================================
    // GET /api/libraries/:id
    // ============================================================
    describe('GET /api/libraries/:id', () => {
        test('should return library by ID with item count', async () => {
            const response = await request(app)
                .get(`/api/libraries/${testLibraryId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .expect(200);

            expect(response.body.id).toBe(testLibraryId);
            expect(response.body.name).toBe('Movies');
            expect(response.body.media_type).toBe('movie');
            expect(response.body).toHaveProperty('item_count');
        });

        test('should return 404 for non-existent library', async () => {
            const response = await request(app)
                .get('/api/libraries/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .expect(404);

            expect(response.body.error).toBe('Library not found');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .get(`/api/libraries/${testLibraryId}`)
                .expect(401);
        });
    });

    // ============================================================
    // PUT /api/libraries/:id
    // ============================================================
    describe('PUT /api/libraries/:id', () => {
        test('should update library name', async () => {
            const response = await request(app)
                .put(`/api/libraries/${testLibraryId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Movies HD' })
                .expect(200);

            expect(response.body.name).toBe('Movies HD');
            expect(response.body.id).toBe(testLibraryId);

            // Restore for other tests
            await db.query(`UPDATE libraries SET name = 'Movies' WHERE id = $1`, [testLibraryId]);
        });

        test('should update library priority', async () => {
            const response = await request(app)
                .put(`/api/libraries/${testLibraryId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ priority: 10 })
                .expect(200);

            expect(response.body.priority).toBe(10);

            // Restore
            await db.query(`UPDATE libraries SET priority = 5 WHERE id = $1`, [testLibraryId]);
        });

        test('should update is_active flag', async () => {
            const response = await request(app)
                .put(`/api/libraries/${testLibraryId}`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ is_active: false })
                .expect(200);

            expect(response.body.is_active).toBe(false);

            // Restore
            await db.query(`UPDATE libraries SET is_active = true WHERE id = $1`, [testLibraryId]);
        });

        test('should return 404 for non-existent library', async () => {
            const response = await request(app)
                .put('/api/libraries/999999')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ name: 'Ghost Library' })
                .expect(404);

            expect(response.body.error).toBe('Library not found');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .put(`/api/libraries/${testLibraryId}`)
                .send({ name: 'Unauthorized Update' })
                .expect(401);
        });
    });

    // ============================================================
    // Label management - GET, POST, DELETE
    // ============================================================
    describe('Library Label Management', () => {
        let testPresetId;

        beforeAll(async () => {
            const presetResult = await db.query(`
                INSERT INTO label_presets (category, name, display_name, description)
                VALUES ('genre', 'test_action', 'Action', 'Action movies')
                RETURNING id
            `);
            testPresetId = presetResult.rows[0].id;
        });

        afterAll(async () => {
            await db.query('DELETE FROM library_labels WHERE label_preset_id = $1', [testPresetId]);
            await db.query('DELETE FROM label_presets WHERE id = $1', [testPresetId]);
        });

        describe('GET /api/libraries/:id/labels', () => {
            test('should return empty array when no labels assigned', async () => {
                const response = await request(app)
                    .get(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .expect(200);

                expect(Array.isArray(response.body)).toBe(true);
            });

            test('should return 401 without authentication', async () => {
                await request(app)
                    .get(`/api/libraries/${testLibraryId}/labels`)
                    .expect(401);
            });
        });

        describe('POST /api/libraries/:id/labels', () => {
            test('should assign a label to a library', async () => {
                const response = await request(app)
                    .post(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ label_preset_id: testPresetId, rule_type: 'include' })
                    .expect(200);

                expect(response.body.library_id).toBe(testLibraryId);
                expect(response.body.label_preset_id).toBe(testPresetId);
                expect(response.body.rule_type).toBe('include');
                expect(response.body.id).toBeDefined();
            });

            test('should upsert rule_type when label already assigned', async () => {
                const response = await request(app)
                    .post(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ label_preset_id: testPresetId, rule_type: 'exclude' })
                    .expect(200);

                expect(response.body.rule_type).toBe('exclude');
            });

            test('should return 401 without authentication', async () => {
                await request(app)
                    .post(`/api/libraries/${testLibraryId}/labels`)
                    .send({ label_preset_id: testPresetId, rule_type: 'include' })
                    .expect(401);
            });
        });

        describe('DELETE /api/libraries/:id/labels/:labelId', () => {
            test('should remove a label from a library', async () => {
                // Ensure we have a label assigned
                await request(app)
                    .post(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .send({ label_preset_id: testPresetId, rule_type: 'include' })
                    .expect(200);

                // Get the label record ID (library_labels.id)
                const labelsResp = await request(app)
                    .get(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .expect(200);

                const label = labelsResp.body.find(l => l.preset_id === testPresetId);
                expect(label).toBeDefined();

                const response = await request(app)
                    .delete(`/api/libraries/${testLibraryId}/labels/${label.id}`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .expect(200);

                expect(response.body.success).toBe(true);

                // Confirm removed
                const afterResp = await request(app)
                    .get(`/api/libraries/${testLibraryId}/labels`)
                    .set('Authorization', `Bearer ${testToken}`)
                    .expect(200);

                const stillThere = afterResp.body.find(l => l.preset_id === testPresetId);
                expect(stillThere).toBeUndefined();
            });

            test('should return 401 without authentication', async () => {
                await request(app)
                    .delete(`/api/libraries/${testLibraryId}/labels/1`)
                    .expect(401);
            });
        });
    });

    // ============================================================
    // PUT /api/libraries/:id/arr-settings
    // ============================================================
    describe('PUT /api/libraries/:id/arr-settings', () => {
        test('should update arr-settings for a movie library', async () => {
            const settings = { root_folder: '/movies', quality_profile_id: 2 };

            const response = await request(app)
                .put(`/api/libraries/${testLibraryId}/arr-settings`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ settings })
                .expect(200);

            expect(response.body.id).toBe(testLibraryId);
            // Movie library stores radarr_settings
            const stored = typeof response.body.radarr_settings === 'string'
                ? JSON.parse(response.body.radarr_settings)
                : response.body.radarr_settings;
            expect(stored.root_folder).toBe('/movies');
        });

        test('should update arr-settings for a TV library', async () => {
            const settings = { root_folder: '/tvshows', quality_profile_id: 1 };

            const response = await request(app)
                .put(`/api/libraries/${testTvLibraryId}/arr-settings`)
                .set('Authorization', `Bearer ${testToken}`)
                .send({ settings })
                .expect(200);

            expect(response.body.id).toBe(testTvLibraryId);
            // TV library stores sonarr_settings
            const stored = typeof response.body.sonarr_settings === 'string'
                ? JSON.parse(response.body.sonarr_settings)
                : response.body.sonarr_settings;
            expect(stored.root_folder).toBe('/tvshows');
        });

        test('should return 404 for non-existent library', async () => {
            const response = await request(app)
                .put('/api/libraries/999999/arr-settings')
                .set('Authorization', `Bearer ${testToken}`)
                .send({ settings: { root_folder: '/noop' } })
                .expect(404);

            expect(response.body.error).toBe('Library not found');
        });

        test('should return 401 without authentication', async () => {
            await request(app)
                .put(`/api/libraries/${testLibraryId}/arr-settings`)
                .send({ settings: {} })
                .expect(401);
        });
    });
});
