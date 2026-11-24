import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createLogsRouter } = await import('../../routes/logsRouteShared.mjs');
const { persistRagLoopStageEvents } = await import('../../services/classificationPersistenceRagEvents.mjs');
const { RAGLogger } = await import('../../utils/ragLogger.mjs');
const ragErrorHandler = await import('../../utils/ragErrorHandler.mjs');

const express = (await import('express')).default;
const logger = createLogger('logs-integration-test');

const RAG_LOGS_DDL = `
    CREATE TABLE IF NOT EXISTS rag_logs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(20) NOT NULL,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`;

function mockRateLimit() {
    return (_req, _res, next) => next();
}

const app = createIntegrationTestApp({
    basePath: '/api/logs',
    router: createLogsRouter({
        express,
        rateLimit: mockRateLimit,
        db,
        authenticateToken,
        requireAdmin,
        logger,
    }),
});

describe('Logs Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(RAG_LOGS_DDL);

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('logs_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'logs_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM error_log');
        await db.query('DELETE FROM app_log');
        await db.query('DELETE FROM rag_logs');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedErrorLog(overrides = {}) {
        const defaults = {
            level: 'ERROR',
            module: 'test-module',
            message: 'Test error message',
            stack_trace: null,
            request_context: null,
            system_context: null,
            metadata: null,
            resolved: false,
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO error_log (level, module, message, stack_trace, request_context, system_context, metadata, resolved)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [data.level, data.module, data.message, data.stack_trace,
            data.request_context ? JSON.stringify(data.request_context) : null,
            data.system_context ? JSON.stringify(data.system_context) : null,
            data.metadata ? JSON.stringify(data.metadata) : null,
            data.resolved]);
        return result.rows[0];
    }

    it('lists and filters exact History IDs without narrowing or casting saved metadata', async () => {
        const lower = '9007199254740992';
        const upper = '9007199254740993';
        const max = '9223372036854775807';
        const padded = `${'0'.repeat(24)}${upper}`;
        const fixtures = [
            ['above integer range', '2147483648', null, 2147483648],
            ['last safe number', '9007199254740991', null, 9007199254740991],
            ['lower typed ID', lower, `{"classificationId":"${upper}"}`, lower],
            ['exact legacy JSON number', null, `{"classificationId":${upper}}`, upper],
            ['upper typed ID', upper, null, upper],
            ['padded legacy text', null, JSON.stringify({ classificationId: padded }), upper],
            ['maximum typed ID', max, null, max],
            ['legacy overflow', null, '{"classificationId":9223372036854775808}', null],
            ['oversized legacy text', null, JSON.stringify({ classificationId: `${max}0` }), null],
            ['malformed legacy ID', null, '{"classificationId":{"id":42}}', null],
            ['zero typed ID', '0', `{"classificationId":"${upper}"}`, null],
        ];

        for (const [index, [message, id, metadata]] of fixtures.entries()) {
            await db.query(`
                INSERT INTO error_log (level, module, message, classification_id, metadata, created_at)
                VALUES ('ERROR', 'history-filter', $1, $2, $3, TIMESTAMP '2026-01-01' + $4 * INTERVAL '1 second')
            `, [message, id, metadata, index]);
        }

        const all = await request(app).get('/api/logs?module=history-filter').set(authHeaders()).expect(200);
        expect(all.body.logs.map(({ message, classification_id }) => [message, classification_id]))
            .toEqual(fixtures.map(([message, , , expected]) => [message, expected]).reverse());

        const firstPage = await request(app)
            .get(`/api/logs?module=history-filter&classification_id=${upper}&classificationId=${upper}&limit=1`)
            .set(authHeaders()).expect(200);
        expect(firstPage.body.pagination).toEqual({ page: 1, limit: 1, total: 3, totalPages: 3 });
        expect(firstPage.body.logs).toMatchObject([{ message: 'padded legacy text', classification_id: upper }]);

        const nextPage = await request(app).get(`/api/logs?classificationId=${upper}&page=2&limit=1`)
            .set(authHeaders()).expect(200);
        expect(nextPage.body.logs).toMatchObject([{ message: 'upper typed ID', classification_id: upper }]);

        const matchingLower = await request(app).get(`/api/logs?classification_id=${lower}`)
            .set(authHeaders()).expect(200);
        expect(matchingLower.body.logs).toMatchObject([
            { message: 'lower typed ID', classification_id: lower },
        ]);

        const raw = await request(app).get(`/api/logs/export?classification_id=${upper}`)
            .set(authHeaders()).expect(200);
        expect(raw.headers['content-disposition']).toContain('logs-export-');
        expect(raw.body).toMatchObject([
            { message: 'padded legacy text', classification_id: null, metadata: { classificationId: padded } },
            { message: 'upper typed ID', classification_id: upper, metadata: null },
            { message: 'exact legacy JSON number', classification_id: null, metadata: { classificationId: Number(lower) } },
        ]);

        const maxExport = await request(app).get(`/api/logs/export?classificationId=${max}`)
            .set(authHeaders()).expect(200);
        expect(maxExport.body).toMatchObject([{ message: 'maximum typed ID', classification_id: max }]);
    });

    it('preserves exact History IDs from the RAG producer through the native reader and administrator filters', async () => {
        const lower = '9007199254740992';
        const upper = '9007199254740993';
        const max = '9223372036854775807';
        const fixtures = [
            [lower, 'policy_recheck', 'policy_recheck_failed', lower],
            [upper, 'trace', 'trace_build_failed', upper],
            [max, 'ai_rerun', 'ai_rerun_failed', max],
            [Number.MAX_SAFE_INTEGER + 1, 'gate', 'rag_stage_fixture_failed', null],
        ];

        for (const [classificationId, stage, reasonCode] of fixtures) {
            await persistRagLoopStageEvents({
                classificationId,
                result: { ragLoopLogContext: { events: [{ stage, reason_code: reasonCode, outcome: 'error' }] } },
            }, ragErrorHandler);
        }

        const recent = await new RAGLogger().getRecentErrors(10, 'second_pass');
        expect(recent).toHaveLength(fixtures.length);
        for (const [, stage, , classificationId] of fixtures) {
            expect(recent.find((row) => row.stage === stage)).toMatchObject({ stage, classificationId });
        }

        for (const [id, stage] of fixtures.slice(0, 3)) {
            const page = await request(app).get(`/api/logs?classificationId=${id}`)
                .set(authHeaders()).expect(200);
            expect(page.body.logs).toMatchObject([{ classification_id: id, error_stage: stage }]);
            expect(page.body.pagination.total).toBe(1);
            const exported = await request(app).get(`/api/logs/export?classification_id=${id}`)
                .set(authHeaders()).expect(200);
            expect(exported.body).toMatchObject([{ classification_id: id, error_stage: stage }]);
            expect(exported.body[0].metadata).not.toHaveProperty('classificationId');
        }
    });

    it('preserves exact History IDs in the older-schema fallback and administrator filters', async () => {
        const pool = getPool();
        const connection = await pool.connect();
        const id = '9007199254740993';
        try {
            await connection.query('CREATE TEMP TABLE error_log (LIKE public.error_log INCLUDING DEFAULTS)');
            await connection.query('ALTER TABLE pg_temp.error_log DROP COLUMN classification_id');
            // All queries in this test use the same real session so they can see the temporary relation.
            const query = jest.spyOn(pool, 'query').mockImplementation((...args) => connection.query(...args));
            try {
                const result = await new RAGLogger().logStageEvent({
                    classification_id: id, stage: 'trace', outcome: 'error', reason_code: 'trace_build_failed',
                });
                expect(result).toEqual({ logged: true, deduped: false });
                expect(query).toHaveBeenCalledTimes(2);
                await expect(query.mock.results[0].value).rejects.toMatchObject({ code: '42703' });

                const page = await request(app).get(`/api/logs?classificationId=${id}`)
                    .set(authHeaders()).expect(200);
                expect(page.body.logs).toMatchObject([{ classification_id: id, module: 'RAG' }]);
                expect(page.body.pagination.total).toBe(1);

                const exported = await request(app).get(`/api/logs/export?classification_id=${id}`)
                    .set(authHeaders()).expect(200);
                expect(exported.body).toMatchObject([{ metadata: { classificationId: id }, module: 'RAG' }]);
                expect(exported.body[0]).not.toHaveProperty('classification_id');
            } finally {
                query.mockRestore();
            }
        } finally {
            connection.release(true);
        }
    });

    describe('GET / — list logs', () => {
        it('returns paginated error logs', async () => {
            await seedErrorLog({ message: 'Error 1' });
            await seedErrorLog({ message: 'Error 2' });

            const res = await request(app)
                .get('/api/logs?page=1&limit=10')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(2);
            expect(res.body.pagination).toMatchObject({
                page: 1,
                limit: 10,
                total: 2,
                totalPages: 1,
            });
        });

        it('filters by level', async () => {
            await seedErrorLog({ level: 'ERROR', message: 'Error log' });
            await seedErrorLog({ level: 'WARN', message: 'Warning log' });

            const res = await request(app)
                .get('/api/logs?level=ERROR')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(1);
            expect(res.body.logs[0].level).toBe('ERROR');
        });

        it('filters by module', async () => {
            await seedErrorLog({ module: 'classification', message: 'M1' });
            await seedErrorLog({ module: 'ollama', message: 'M2' });

            const res = await request(app)
                .get('/api/logs?module=classification')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(1);
            expect(res.body.logs[0].module).toBe('classification');
        });

        it('filters by resolved status', async () => {
            await seedErrorLog({ resolved: true, message: 'Resolved' });
            await seedErrorLog({ resolved: false, message: 'Unresolved' });

            const res = await request(app)
                .get('/api/logs?resolved=false')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(1);
            expect(res.body.logs[0].resolved).toBe(false);
        });

        it('returns empty logs with correct pagination when no records', async () => {
            const res = await request(app)
                .get('/api/logs?page=1&limit=10')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(0);
            expect(res.body.pagination.total).toBe(0);
        });
    });

    describe('GET /error/:errorId', () => {
        it('returns a single error log by error_id', async () => {
            const row = await seedErrorLog({ message: 'Specific error' });

            const res = await request(app)
                .get(`/api/logs/error/${row.error_id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.error_id).toBe(row.error_id);
            expect(res.body.message).toBe('Specific error');
        });

        it('returns 404 for non-existent error_id', async () => {
            const res = await request(app)
                .get('/api/logs/error/00000000-0000-0000-0000-000000000000')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Error log not found');
        });
    });

    describe('GET /error/:errorId/report', () => {
        it('generates a markdown bug report for an error', async () => {
            const row = await seedErrorLog({
                message: 'Report test',
                stack_trace: 'Error at line 1\n    at test.js:5',
                metadata: { actor: 'admin' },
            });

            const res = await request(app)
                .get(`/api/logs/error/${row.error_id}/report`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.report).toContain('Bug Report');
            expect(res.body.report).toContain(row.error_id);
            expect(res.body.report).toContain('Report test');
            expect(res.body.report).toContain('Stack Trace');
            expect(res.body.report).toContain('Additional Data');
        });

        it('returns 404 for non-existent error_id', async () => {
            const res = await request(app)
                .get('/api/logs/error/00000000-0000-0000-0000-000000000000/report')
                .set(authHeaders());

            expect(res.status).toBe(404);
        });
    });

    describe('GET /export', () => {
        it('exports all error logs as JSON', async () => {
            await seedErrorLog({ message: 'Export 1' });
            await seedErrorLog({ message: 'Export 2' });

            const res = await request(app)
                .get('/api/logs/export')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.headers['content-disposition']).toContain('logs-export-');
        });
    });

    describe('GET /stats', () => {
        it('returns log statistics', async () => {
            await seedErrorLog({ level: 'ERROR', message: 'E1' });
            await seedErrorLog({ level: 'WARN', message: 'W1' });
            await seedErrorLog({ level: 'ERROR', resolved: true, message: 'E2' });

            const res = await request(app)
                .get('/api/logs/stats')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.totals).toBeDefined();
            expect(Number(res.body.totals.total_logs)).toBe(3);
            expect(Number(res.body.totals.total_errors)).toBe(2);
            expect(Number(res.body.totals.total_warnings)).toBe(1);
            expect(Number(res.body.totals.total_resolved)).toBe(1);
            expect(res.body.topModules).toBeDefined();
            expect(res.body.trends).toBeDefined();
            expect(res.body.trends.last24h).toBeDefined();
            expect(res.body.trends.last7d).toBeDefined();
        });
    });

    describe('POST /error/:errorId/resolve', () => {
        it('marks an error as resolved', async () => {
            const row = await seedErrorLog({ resolved: false, message: 'Unresolved' });

            const res = await request(app)
                .post(`/api/logs/error/${row.error_id}/resolve`)
                .set(authHeaders())
                .send({ notes: 'Fixed in v1.0' });

            expect(res.status).toBe(200);
            expect(res.body.resolved).toBe(true);
            expect(res.body.resolution_notes).toBe('Fixed in v1.0');
            expect(res.body.resolved_at).toBeTruthy();
        });

        it('resolves without notes', async () => {
            const row = await seedErrorLog({ message: 'No notes' });

            const res = await request(app)
                .post(`/api/logs/error/${row.error_id}/resolve`)
                .set(authHeaders())
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.resolved).toBe(true);
        });

        it('returns 404 for non-existent error_id', async () => {
            const res = await request(app)
                .post('/api/logs/error/00000000-0000-0000-0000-000000000000/resolve')
                .set(authHeaders())
                .send({ notes: 'test' });

            expect(res.status).toBe(404);
        });
    });

    describe('POST /cleanup', () => {
        it('deletes old logs based on retention settings', async () => {
            await db.query(`INSERT INTO settings (key, value) VALUES ('error_log_retention_days', '0') ON CONFLICT (key) DO UPDATE SET value = '0'`);
            await db.query(`INSERT INTO settings (key, value) VALUES ('log_retention_days', '0') ON CONFLICT (key) DO UPDATE SET value = '0'`);
            await db.query(`INSERT INTO settings (key, value) VALUES ('rag_log_retention_days', '0') ON CONFLICT (key) DO UPDATE SET value = '0'`);

            await seedErrorLog({ message: 'Old error' });
            await db.query(`INSERT INTO app_log (level, module, message) VALUES ('INFO', 'test', 'Old app log')`);
            await db.query(`INSERT INTO rag_logs (level, type, message) VALUES ('info', 'embedding', 'Old rag log')`);

            const res = await request(app)
                .post('/api/logs/cleanup')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deleted).toBeDefined();
            expect(res.body.deleted.errorLogs).toBeGreaterThanOrEqual(0);
            expect(res.body.deleted.appLogs).toBeGreaterThanOrEqual(0);
            expect(res.body.deleted.ragLogs).toBeGreaterThanOrEqual(0);
        });
    });

    describe('DELETE /', () => {
        it('clears all logs', async () => {
            await seedErrorLog({ message: 'Error to delete' });
            await db.query(`INSERT INTO app_log (level, module, message) VALUES ('INFO', 'test', 'App to delete')`);
            await db.query(`INSERT INTO rag_logs (level, type, message) VALUES ('info', 'test', 'Rag to delete')`);

            const res = await request(app)
                .delete('/api/logs')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.deleted).toBeDefined();
            expect(res.body.deleted.errorLogs).toBeGreaterThanOrEqual(1);
            expect(res.body.deleted.appLogs).toBeGreaterThanOrEqual(1);
            expect(res.body.deleted.ragLogs).toBeGreaterThanOrEqual(1);

            const remainingErrors = await db.query('SELECT COUNT(*) FROM error_log');
            expect(Number(remainingErrors.rows[0].count)).toBe(0);
        });
    });
});
