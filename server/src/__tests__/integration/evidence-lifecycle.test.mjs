import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const { ClassificationEvidenceRepository } = await import('../../services/classificationEvidenceRepository.mjs');
const { EvidenceDiagnosticsService } = await import('../../services/evidenceDiagnosticsService.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createEvidenceRouter } = await import('../../routes/evidenceRouteShared.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const authService = await import('../../services/auth.mjs');

const express = (await import('express')).default;
const logger = createLogger('evidence-integration-test');

const EVIDENCE_DDL = `
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

const evidenceRepository = new ClassificationEvidenceRepository({ db });
const evidenceDiagnosticsService = new EvidenceDiagnosticsService({ db, repository: evidenceRepository });

const app = createIntegrationTestApp({
    basePath: '/api/evidence',
    middleware: [authenticateToken],
    router: createEvidenceRouter({
        express,
        classificationEvidenceRepository: evidenceRepository,
        evidenceDiagnosticsService,
        logger,
    }),
});

describe('Evidence Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(EVIDENCE_DDL);

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('evidence_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'evidence_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM classification_evidence');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedEvidence(overrides = {}) {
        const defaults = {
            scope: 'item_exact',
            media_type: 'movie',
            library_id: null,
            tmdb_id: 100,
            evidence_key: 'tmdb:100',
            evidence_data: JSON.stringify({ genre: 'Action' }),
            provenance: 'human_confirmed',
            confidence: 85.5,
            usage_count: 5,
            success_rate: 90.0,
            status: 'active',
            created_by: 'admin',
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO classification_evidence
                (scope, media_type, library_id, tmdb_id, evidence_key, evidence_data,
                 provenance, confidence, usage_count, success_rate, status, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            data.scope, data.media_type, data.library_id, data.tmdb_id,
            data.evidence_key, data.evidence_data, data.provenance,
            data.confidence, data.usage_count, data.success_rate,
            data.status, data.created_by,
        ]);
        return result.rows[0];
    }

    describe('GET /summary', () => {
        it('returns empty summary when no evidence exists', async () => {
            const res = await request(app)
                .get('/api/evidence/summary')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.byScope).toBeDefined();
            expect(res.body.byProvenance).toBeDefined();
            expect(res.body.byStatus).toBeDefined();
        });

        it('returns summary with counts grouped by scope, provenance, and status', async () => {
            await seedEvidence({ scope: 'item_exact', provenance: 'human_confirmed', status: 'active' });
            await seedEvidence({ scope: 'genre', provenance: 'policy_confirmed', status: 'candidate', tmdb_id: 101 });
            await seedEvidence({ scope: 'genre', provenance: 'mined', status: 'active', tmdb_id: 102 });

            const res = await request(app)
                .get('/api/evidence/summary')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.total).toBe(3);
        });
    });

    describe('GET / — list evidence', () => {
        it('returns paginated evidence rows', async () => {
            await seedEvidence({ tmdb_id: 200 });
            await seedEvidence({ tmdb_id: 201 });

            const res = await request(app)
                .get('/api/evidence?limit=10&offset=0')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.rows).toHaveLength(2);
            expect(res.body.total).toBe(2);
            expect(res.body.limit).toBe(10);
            expect(res.body.offset).toBe(0);
        });

        it('filters by scope', async () => {
            await seedEvidence({ scope: 'item_exact', tmdb_id: 300 });
            await seedEvidence({ scope: 'genre', tmdb_id: 301 });

            const res = await request(app)
                .get('/api/evidence?scope=genre')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.rows).toHaveLength(1);
            expect(res.body.rows[0].scope).toBe('genre');
        });

        it('filters by status', async () => {
            await seedEvidence({ status: 'active', tmdb_id: 400 });
            await seedEvidence({ status: 'candidate', tmdb_id: 401 });

            const res = await request(app)
                .get('/api/evidence?status=candidate')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.rows).toHaveLength(1);
            expect(res.body.rows[0].status).toBe('candidate');
        });

        it('filters by provenance', async () => {
            await seedEvidence({ provenance: 'human_confirmed', tmdb_id: 500 });
            await seedEvidence({ provenance: 'mined', tmdb_id: 501 });

            const res = await request(app)
                .get('/api/evidence?provenance=mined')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.rows).toHaveLength(1);
            expect(res.body.rows[0].provenance).toBe('mined');
        });

        it('respects limit and offset for pagination', async () => {
            for (let i = 600; i < 605; i++) {
                await seedEvidence({ tmdb_id: i });
            }

            const res = await request(app)
                .get('/api/evidence?limit=2&offset=0')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.rows).toHaveLength(2);
            expect(res.body.total).toBe(5);
        });
    });

    describe('GET /:id', () => {
        it('returns a single evidence row by id', async () => {
            const row = await seedEvidence({ tmdb_id: 700 });

            const res = await request(app)
                .get(`/api/evidence/${row.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(row.id);
            expect(res.body.scope).toBe('item_exact');
            expect(res.body.tmdb_id).toBe(700);
        });

        it('returns 404 for non-existent id', async () => {
            const res = await request(app)
                .get('/api/evidence/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Evidence row not found');
        });

        it('returns 400 for invalid id', async () => {
            const res = await request(app)
                .get('/api/evidence/abc')
                .set(authHeaders());

            expect(res.status).toBe(400);
        });
    });

    describe('GET /:id/diagnose', () => {
        it('returns diagnosis for an evidence row', async () => {
            const row = await seedEvidence({ tmdb_id: 800 });

            const res = await request(app)
                .get(`/api/evidence/${row.id}/diagnose`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.evidence).toBeDefined();
            expect(res.body.evidence.id).toBe(row.id);
            expect(res.body.diagnosis).toBeDefined();
            expect(res.body.diagnosis.evidenceId).toBe(row.id);
        });

        it('returns 404 for non-existent id', async () => {
            const res = await request(app)
                .get('/api/evidence/999999/diagnose')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Evidence row not found');
        });
    });

    describe('POST /:id/decay', () => {
        it('decays an active row to candidate status', async () => {
            const row = await seedEvidence({ status: 'active', tmdb_id: 900 });

            const res = await request(app)
                .post(`/api/evidence/${row.id}/decay`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.changed).toBe(true);
            expect(res.body.row.status).toBe('candidate');
        });

        it('returns changed: false when row is already candidate', async () => {
            const row = await seedEvidence({ status: 'candidate', tmdb_id: 901 });

            const res = await request(app)
                .post(`/api/evidence/${row.id}/decay`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.changed).toBe(false);
            expect(res.body.message).toBe('Row already in candidate status');
        });

        it('returns 404 for non-existent id', async () => {
            const res = await request(app)
                .post('/api/evidence/999999/decay')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('POST /:id/promote', () => {
        it('promotes a candidate row to active status', async () => {
            const row = await seedEvidence({ status: 'candidate', tmdb_id: 1000 });

            const res = await request(app)
                .post(`/api/evidence/${row.id}/promote`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.changed).toBe(true);
            expect(res.body.row.status).toBe('active');
        });

        it('returns changed: false when row is already active', async () => {
            const row = await seedEvidence({ status: 'active', tmdb_id: 1001 });

            const res = await request(app)
                .post(`/api/evidence/${row.id}/promote`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.changed).toBe(false);
            expect(res.body.message).toBe('Row already active');
        });

        it('returns 404 for non-existent id', async () => {
            const res = await request(app)
                .post('/api/evidence/999999/promote')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('POST /purge', () => {
        it('purges evidence rows matching filter', async () => {
            await seedEvidence({ scope: 'genre', provenance: 'mined', tmdb_id: 1100 });
            await seedEvidence({ scope: 'item_exact', provenance: 'human_confirmed', tmdb_id: 1101 });

            const res = await request(app)
                .post('/api/evidence/purge')
                .set(authHeaders())
                .send({ scope: 'genre' });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toBe(1);
            expect(res.body.filter.scope).toBe('genre');
        });

        it('returns 400 when no filter provided', async () => {
            const res = await request(app)
                .post('/api/evidence/purge')
                .set(authHeaders())
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('At least one filter');
        });

        it('purges by status filter', async () => {
            await seedEvidence({ status: 'candidate', tmdb_id: 1200 });
            await seedEvidence({ status: 'active', tmdb_id: 1201 });

            const res = await request(app)
                .post('/api/evidence/purge')
                .set(authHeaders())
                .send({ status: 'candidate' });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toBe(1);
        });

        it('purges by provenance filter', async () => {
            await seedEvidence({ provenance: 'mined', tmdb_id: 1300 });
            await seedEvidence({ provenance: 'human_confirmed', tmdb_id: 1301 });

            const res = await request(app)
                .post('/api/evidence/purge')
                .set(authHeaders())
                .send({ provenance: 'mined' });

            expect(res.status).toBe(200);
            expect(res.body.deleted).toBe(1);
        });
    });
});
