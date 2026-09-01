import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken, requireAdmin } = await import('../../middleware/auth.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createLogsRouter } = await import('../../routes/logsRouteShared.mjs');

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
