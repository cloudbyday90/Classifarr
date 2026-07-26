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
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { classificationOutcomeService } = await import('../../services/classificationOutcomeService.mjs');
const { classificationEvidenceService } = await import('../../services/classificationEvidenceService.mjs');
const { classificationEvidenceReinforcementService } = await import('../../services/classificationEvidenceReinforcementService.mjs');
const { PATTERN_SIGNAL_TYPES } = await import('../../services/signalCollector.mjs');
const { reclassificationService } = await import('../../services/reclassificationService.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createClassificationRouter } = await import('../../routes/classificationRouteShared.mjs');
const { requireReadWrite } = await import('../../middleware/apiKeyAuth.mjs');

const express = (await import('express')).default;
const logger = createLogger('corrections-integration-test');

const CLASSIFICATION_EVIDENCE_DDL = `
    CREATE TABLE IF NOT EXISTS classification_evidence (
        id SERIAL PRIMARY KEY,
        scope VARCHAR(50) NOT NULL,
        media_type VARCHAR(20),
        library_id INTEGER,
        tmdb_id INTEGER,
        evidence_key VARCHAR(255),
        evidence_data JSONB,
        provenance VARCHAR(50) NOT NULL,
        confidence NUMERIC(5,2),
        usage_count INTEGER DEFAULT 0 NOT NULL,
        success_rate NUMERIC(5,2),
        status VARCHAR(20) DEFAULT 'active' NOT NULL,
        created_by VARCHAR(100),
        source_classification_id BIGINT,
        source_system VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        last_seen_at TIMESTAMPTZ
    );
`;

const LIBRARY_ARR_MAPPINGS_DDL = `
    CREATE TABLE IF NOT EXISTS library_arr_mappings (
        id SERIAL PRIMARY KEY,
        library_id INTEGER NOT NULL,
        arr_type VARCHAR(10) NOT NULL,
        arr_config_id INTEGER NOT NULL,
        arr_root_folder_id INTEGER NOT NULL,
        arr_root_folder_path VARCHAR(512) NOT NULL,
        quality_profile_id INTEGER,
        plex_path_prefix VARCHAR(512),
        arr_path_prefix VARCHAR(512),
        classifarr_path_prefix VARCHAR(512),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

async function ensureSchemaColumns() {
    const colCheck = await db.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'classification_history' AND column_name = 'library_name'
    `);
    if (colCheck.rows.length === 0) {
        await db.query('ALTER TABLE classification_history ADD COLUMN library_name VARCHAR(255)');
    }
}

const app = createIntegrationTestApp({
    basePath: '/api/classification',
    middleware: [authenticateToken, requireAdmin],
    router: createClassificationRouter({
        express,
        db,
        classificationService: null,
        classificationRetryService: null,
        classificationOutcomeService,
        clarificationService: null,
        classificationEvidenceService,
        classificationEvidenceReinforcementService,
        PATTERN_SIGNAL_TYPES,
        createLogger: () => logger,
        requireReadWrite,
        STALE_AWAITING_DECISION_DAYS: 7,
        reclassificationService,
    }),
});

describe('Classification Corrections Integration Tests', () => {
    let testUserId;
    let testToken;
    let libraryA;
    let libraryB;
    let libraryC;

    beforeAll(async () => {
        await db.query(CLASSIFICATION_EVIDENCE_DDL);
        await db.query(LIBRARY_ARR_MAPPINGS_DDL);
        await ensureSchemaColumns();

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('corrections_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'corrections_test_user',
            role: 'admin',
        });

        libraryA = await seedLibrary('Movies', 'movie');
        libraryB = await seedLibrary('TV Shows', 'tv');
        libraryC = await seedLibrary('Anime Movies', 'movie');
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM classification_corrections WHERE classification_id IN (SELECT id FROM classification_history WHERE title LIKE \'CorrTest%\')');
        await db.query('DELETE FROM classification_history WHERE title LIKE \'CorrTest%\'');
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await db.query('DELETE FROM libraries WHERE id = ANY($1)', [[libraryA.id, libraryB.id, libraryC.id]]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM classification_corrections');
        await db.query('DELETE FROM classification_evidence');
        await db.query('DELETE FROM classification_history WHERE title LIKE \'CorrTest%\'');
    });

    async function seedLibrary(name, mediaType) {
        const result = await db.query(`
            INSERT INTO libraries (name, external_id, media_type, is_active)
            VALUES ($1, $1, $2, true)
            RETURNING id, name
        `, [name, mediaType]);
        return result.rows[0];
    }

    async function seedClassification(title, libraryId, mediaType = 'movie') {
        const result = await db.query(`
            INSERT INTO classification_history (title, media_type, library_id, library_name, method, status, confidence, tmdb_id, metadata)
            VALUES ($1, $2, $3, (SELECT name FROM libraries WHERE id = $3), 'exact_match', 'completed', 85, 10001, '{}')
            RETURNING id, library_id, status
        `, [title, mediaType, libraryId]);
        return result.rows[0];
    }

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    describe('POST /corrections', () => {
        it('corrects a classification with the authenticated actor and guarded exact-item memory', async () => {
            const cls = await seedClassification('CorrTest Movie 1', libraryA.id);

            const res = await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                    corrected_by: 'test_user',
                });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                classification_id: cls.id,
                original_library_id: libraryA.id,
                corrected_library_id: libraryC.id,
                corrected_by: 'corrections_test_user',
                policy_learning: {
                    status: 'ready',
                    decision_id: 'candidate',
                    tier_id: 'exact_item_memory',
                    exact_item_memory_eligible: true,
                    exact_item_memory_recorded: true,
                },
            });
            expect(res.body.id).toBeDefined();

            const history = await db.query('SELECT library_id, library_name, status FROM classification_history WHERE id = $1', [cls.id]);
            expect(history.rows[0].library_id).toBe(libraryC.id);
            expect(history.rows[0].library_name).toBe(libraryC.name);
            expect(history.rows[0].status).toBe('corrected');

            const corrections = await db.query('SELECT * FROM classification_corrections WHERE classification_id = $1', [cls.id]);
            expect(corrections.rows).toHaveLength(1);
            expect(corrections.rows[0].original_library_id).toBe(libraryA.id);
            expect(corrections.rows[0].corrected_library_id).toBe(libraryC.id);

            const receipts = await db.query(`
                SELECT source_id, source_event_id, classification_id
                FROM policy_authorized_outcome_source_event_receipts
                WHERE classification_id = $1
            `, [cls.id]);
            expect(receipts.rows).toEqual([
                expect.objectContaining({
                    source_id: 'manual_classification_change',
                    source_event_id: `classification_correction:${res.body.id}`,
                    classification_id: cls.id,
                }),
            ]);
        });

        it('rejects a corrected library with a different media type', async () => {
            const cls = await seedClassification('CorrTest Type Mismatch', libraryA.id, 'movie');

            const res = await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryB.id,
                });

            expect(res.status).toBe(400);

            const history = await db.query(
                'SELECT library_id, status FROM classification_history WHERE id = $1',
                [cls.id]
            );
            expect(history.rows[0]).toMatchObject({
                library_id: libraryA.id,
                status: 'completed',
            });
        });

        it('records outcome in classification metadata', async () => {
            const cls = await seedClassification('CorrTest Outcome Movie', libraryA.id);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                });

            const history = await db.query('SELECT metadata FROM classification_history WHERE id = $1', [cls.id]);
            const metadata = history.rows[0].metadata;
            expect(metadata.classification_details.outcome_link.type).toBe('corrected');
            expect(metadata.classification_details.outcome_link.source).toBe('api_correction');
        });

        it('creates evidence exact match for the corrected library', async () => {
            const cls = await seedClassification('CorrTest Evidence Movie', libraryA.id);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                });

            const evidence = await db.query(
                "SELECT * FROM classification_evidence WHERE scope = 'item_exact' AND tmdb_id = 10001"
            );
            expect(evidence.rows).toHaveLength(1);
            expect(evidence.rows[0].library_id).toBe(libraryC.id);
            expect(evidence.rows[0].provenance).toBe('human_confirmed');
        });

        it('returns 400 when classification_id is missing', async () => {
            const res = await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({ corrected_library_id: libraryC.id });

            expect(res.status).toBe(400);
        });

        it('returns 400 when corrected_library_id is missing', async () => {
            const res = await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({ classification_id: 1 });

            expect(res.status).toBe(400);
        });

        it('returns 404 for non-existent classification', async () => {
            const res = await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: 999999,
                    corrected_library_id: libraryC.id,
                });

            expect(res.status).toBe(404);
        });

        it('requires authentication', async () => {
            const res = await request(app)
                .post('/api/classification/corrections')
                .send({
                    classification_id: 1,
                    corrected_library_id: 2,
                });

            expect(res.status).toBe(401);
        });
    });

    describe('POST /reclassify/preview', () => {
        it('returns preview with current and target library info', async () => {
            const cls = await seedClassification('CorrTest Preview Movie', libraryA.id);

            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    target_library_id: libraryC.id,
                });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({
                title: 'CorrTest Preview Movie',
                mediaType: 'movie',
                currentLibrary: libraryA.name,
                targetLibrary: libraryC.name,
            });
        });

        it('reports canProceed false when no arr mapping exists', async () => {
            const cls = await seedClassification('CorrTest NoMapping Movie', libraryA.id);

            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    target_library_id: libraryC.id,
                });

            expect(res.status).toBe(200);
            expect(res.body.canProceed).toBe(false);
            expect(res.body.warning).toContain('mapping');
        });

        it('reports canProceed true when arr mapping exists', async () => {
            const cls = await seedClassification('CorrTest HasMapping Movie', libraryA.id);

            const radarrConfigId = await seedRadarrConfig();
            await seedArrMapping(libraryC.id, radarrConfigId, 'radarr', '/movies/anime');

            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    target_library_id: libraryC.id,
                });

            expect(res.status).toBe(200);
            expect(res.body.canProceed).toBe(true);
            expect(res.body.targetPath).toBe('/movies/anime');
            expect(res.body.warning).toBeNull();
        });

        it('returns 400 when classification_id is missing', async () => {
            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({ target_library_id: libraryC.id });

            expect(res.status).toBe(400);
        });

        it('returns 400 when target_library_id is missing', async () => {
            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({ classification_id: 1 });

            expect(res.status).toBe(400);
        });

        it('returns 404 for non-existent classification', async () => {
            const res = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: 999999,
                    target_library_id: libraryC.id,
                });

            expect(res.status).toBe(404);
        });

        it('preview does not modify classification state', async () => {
            const cls = await seedClassification('CorrTest NoSideEffect', libraryA.id);
            const statusBefore = await db.query('SELECT library_id, status FROM classification_history WHERE id = $1', [cls.id]);

            await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    target_library_id: libraryC.id,
                });

            const statusAfter = await db.query('SELECT library_id, status FROM classification_history WHERE id = $1', [cls.id]);
            expect(statusAfter.rows[0]).toEqual(statusBefore.rows[0]);
        });
    });

    describe('Correction + preview workflow', () => {
        it('corrects then preview reflects updated state', async () => {
            const cls = await seedClassification('CorrTest Workflow Movie', libraryA.id);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                })
                .expect(200);

            const preview = await request(app)
                .post('/api/classification/reclassify/preview')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    target_library_id: libraryA.id,
                });

            expect(preview.status).toBe(200);
            expect(preview.body.currentLibrary).toBe(libraryC.name);
            expect(preview.body.targetLibrary).toBe(libraryA.name);
        });
    });

    describe('DB constraint verification', () => {
        it('classification_corrections cascades on classification delete', async () => {
            const cls = await seedClassification('CorrTest Cascade Movie', libraryA.id);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                })
                .expect(200);

            const correctionsBefore = await db.query('SELECT COUNT(*)::int AS count FROM classification_corrections WHERE classification_id = $1', [cls.id]);
            expect(correctionsBefore.rows[0].count).toBe(1);

            await db.query('DELETE FROM classification_history WHERE id = $1', [cls.id]);

            const correctionsAfter = await db.query('SELECT COUNT(*)::int AS count FROM classification_corrections WHERE classification_id = $1', [cls.id]);
            expect(correctionsAfter.rows[0].count).toBe(0);
        });

        it('allows multiple corrections on the same classification', async () => {
            const cls = await seedClassification('CorrTest MultiCorrect', libraryA.id);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryC.id,
                })
                .expect(200);

            await request(app)
                .post('/api/classification/corrections')
                .set(authHeaders())
                .send({
                    classification_id: cls.id,
                    corrected_library_id: libraryA.id,
                })
                .expect(200);

            const corrections = await db.query('SELECT * FROM classification_corrections WHERE classification_id = $1 ORDER BY id', [cls.id]);
            expect(corrections.rows).toHaveLength(2);
            expect(corrections.rows[0].corrected_library_id).toBe(libraryC.id);
            expect(corrections.rows[1].corrected_library_id).toBe(libraryA.id);

            const history = await db.query('SELECT library_id FROM classification_history WHERE id = $1', [cls.id]);
            expect(history.rows[0].library_id).toBe(libraryA.id);
        });
    });

    async function seedRadarrConfig() {
        const result = await db.query(`
            INSERT INTO radarr_config (url, api_key, name)
            VALUES ('http://localhost:7878', 'test-radarr-key', 'Test Radarr')
            ON CONFLICT DO NOTHING
            RETURNING id
        `);
        if (result.rows.length > 0) return result.rows[0].id;

        const existing = await db.query('SELECT id FROM radarr_config LIMIT 1');
        return existing.rows[0].id;
    }

    async function seedArrMapping(libraryId, configId, arrType, rootPath) {
        await db.query(`
            INSERT INTO library_arr_mappings (library_id, arr_type, arr_config_id, arr_root_folder_id, arr_root_folder_path)
            VALUES ($1, $2, $3, 1, $4)
            ON CONFLICT (library_id) DO UPDATE SET
                arr_type = EXCLUDED.arr_type,
                arr_config_id = EXCLUDED.arr_config_id,
                arr_root_folder_path = EXCLUDED.arr_root_folder_path
        `, [libraryId, arrType, configId, rootPath]);
    }
});
