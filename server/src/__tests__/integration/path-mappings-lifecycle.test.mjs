import { jest } from '@jest/globals';
import request from 'supertest';
import { createIntegrationDatabaseModuleMock, createIntegrationTestApp } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { default: db } = await import('../../config/database.mjs');
const authService = await import('../../services/auth.mjs');
const { authenticateToken } = await import('../../middleware/auth.mjs');
const { createLogger } = await import('../../utils/logger.mjs');
const { createPathMappingsRouter } = await import('../../routes/pathMappingsRouteShared.mjs');

const express = (await import('express')).default;
const logger = createLogger('path-mappings-integration-test');

const PATH_MAPPINGS_DDL = `
    CREATE TABLE IF NOT EXISTS path_mappings (
        id SERIAL PRIMARY KEY,
        arr_path VARCHAR(1024) NOT NULL,
        local_path VARCHAR(1024) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        verified BOOLEAN DEFAULT false,
        last_verified_at TIMESTAMPTZ,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
`;

const mockFs = {
    stat: async (_path) => {
        throw new Error('ENOENT: no such file or directory');
    },
};

const app = createIntegrationTestApp({
    basePath: '/api/settings/path-mappings',
    middleware: [authenticateToken],
    router: createPathMappingsRouter({
        express,
        fs: mockFs,
        db,
        logger,
    }),
});

describe('Path Mappings Lifecycle Integration Tests', () => {
    let testUserId;
    let testToken;

    beforeAll(async () => {
        await db.query(PATH_MAPPINGS_DDL);

        const userResult = await db.query(`
            INSERT INTO users (username, password_hash, role, is_active)
            VALUES ('pathmaps_test_user', 'hashed', 'admin', true)
            RETURNING id
        `);
        testUserId = userResult.rows[0].id;

        testToken = await authService.generateAccessToken({
            id: testUserId,
            username: 'pathmaps_test_user',
            role: 'admin',
        });
    }, 120_000);

    afterAll(async () => {
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    });

    beforeEach(async () => {
        await db.query('DELETE FROM path_mappings');
    });

    function authHeaders(token = testToken) {
        return { Authorization: `Bearer ${token}` };
    }

    async function seedMapping(overrides = {}) {
        const defaults = {
            arr_path: '/media/movies',
            local_path: '/mnt/storage/movies',
            is_active: true,
        };
        const data = { ...defaults, ...overrides };

        const result = await db.query(`
            INSERT INTO path_mappings (arr_path, local_path, is_active)
            VALUES ($1, $2, $3)
            RETURNING *
        `, [data.arr_path, data.local_path, data.is_active]);
        return result.rows[0];
    }

    describe('GET /', () => {
        it('returns empty array when no mappings exist', async () => {
            const res = await request(app)
                .get('/api/settings/path-mappings')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toEqual([]);
        });

        it('returns all path mappings', async () => {
            await seedMapping({ arr_path: '/media/movies', local_path: '/mnt/movies' });
            await seedMapping({ arr_path: '/media/tv', local_path: '/mnt/tv' });

            const res = await request(app)
                .get('/api/settings/path-mappings')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
        });
    });

    describe('POST /', () => {
        it('creates a new path mapping', async () => {
            const res = await request(app)
                .post('/api/settings/path-mappings')
                .set(authHeaders())
                .send({ arr_path: '/media/movies/', local_path: '/mnt/movies/' });

            expect(res.status).toBe(201);
            expect(res.body.arr_path).toBe('/media/movies');
            expect(res.body.local_path).toBe('/mnt/movies');
            expect(res.body.is_active).toBe(true);
        });

        it('trims trailing slashes from paths', async () => {
            const res = await request(app)
                .post('/api/settings/path-mappings')
                .set(authHeaders())
                .send({ arr_path: '/media/movies///', local_path: '/mnt/movies//' });

            expect(res.status).toBe(201);
            expect(res.body.arr_path).toBe('/media/movies');
            expect(res.body.local_path).toBe('/mnt/movies');
        });

        it('returns 400 when arr_path is missing', async () => {
            const res = await request(app)
                .post('/api/settings/path-mappings')
                .set(authHeaders())
                .send({ local_path: '/mnt/movies' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('arr_path and local_path are required');
        });

        it('returns 400 when local_path is missing', async () => {
            const res = await request(app)
                .post('/api/settings/path-mappings')
                .set(authHeaders())
                .send({ arr_path: '/media/movies' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('arr_path and local_path are required');
        });
    });

    describe('PUT /:id', () => {
        it('updates an existing path mapping', async () => {
            const mapping = await seedMapping({ arr_path: '/old', local_path: '/old-local' });

            const res = await request(app)
                .put(`/api/settings/path-mappings/${mapping.id}`)
                .set(authHeaders())
                .send({ arr_path: '/new', local_path: '/new-local' });

            expect(res.status).toBe(200);
            expect(res.body.arr_path).toBe('/new');
            expect(res.body.local_path).toBe('/new-local');
        });

        it('returns 404 for non-existent mapping', async () => {
            const res = await request(app)
                .put('/api/settings/path-mappings/999999')
                .set(authHeaders())
                .send({ arr_path: '/updated' });

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Path mapping not found');
        });

        it('toggles is_active status', async () => {
            const mapping = await seedMapping({ is_active: true });

            const res = await request(app)
                .put(`/api/settings/path-mappings/${mapping.id}`)
                .set(authHeaders())
                .send({ is_active: false });

            expect(res.status).toBe(200);
            expect(res.body.is_active).toBe(false);
        });
    });

    describe('DELETE /:id', () => {
        it('deletes an existing path mapping', async () => {
            const mapping = await seedMapping();

            const res = await request(app)
                .delete(`/api/settings/path-mappings/${mapping.id}`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.message).toBe('Path mapping deleted');
            expect(res.body.deleted.id).toBe(mapping.id);

            const check = await db.query('SELECT * FROM path_mappings WHERE id = $1', [mapping.id]);
            expect(check.rows).toHaveLength(0);
        });

        it('returns 404 for non-existent mapping', async () => {
            const res = await request(app)
                .delete('/api/settings/path-mappings/999999')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Path mapping not found');
        });
    });

    describe('POST /:id/verify', () => {
        it('returns verification failure for inaccessible path', async () => {
            const mapping = await seedMapping({ local_path: '/nonexistent/path' });

            const res = await request(app)
                .post(`/api/settings/path-mappings/${mapping.id}/verify`)
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.verified).toBe(false);
            expect(res.body.success).toBe(false);
        });

        it('returns 404 for non-existent mapping', async () => {
            const res = await request(app)
                .post('/api/settings/path-mappings/999999/verify')
                .set(authHeaders());

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Path mapping not found');
        });
    });

    describe('POST /verify-all', () => {
        it('verifies all active path mappings', async () => {
            await seedMapping({ arr_path: '/a', local_path: '/nonexistent/a', is_active: true });
            await seedMapping({ arr_path: '/b', local_path: '/nonexistent/b', is_active: true });
            await seedMapping({ arr_path: '/c', local_path: '/nonexistent/c', is_active: false });

            const res = await request(app)
                .post('/api/settings/path-mappings/verify-all')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.results).toBeDefined();
            expect(res.body.summary).toBeDefined();
            expect(res.body.summary.total).toBe(2);
            expect(res.body.summary.failed).toBe(2);
            expect(res.body.success).toBe(false);
        });

        it('returns empty results when no active mappings exist', async () => {
            await seedMapping({ is_active: false });

            const res = await request(app)
                .post('/api/settings/path-mappings/verify-all')
                .set(authHeaders());

            expect(res.status).toBe(200);
            expect(res.body.results).toHaveLength(0);
            expect(res.body.summary.total).toBe(0);
        });
    });
});
