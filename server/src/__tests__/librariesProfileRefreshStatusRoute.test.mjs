/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerProfileRefreshStatusRoutes } from '../routes/librariesRouteProfileRefreshStatus.mjs';

function createApp() {
    const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    const app = express();
    app.use((req, _res, next) => {
        req.user = { role: req.get('x-test-role') || 'viewer' };
        next();
    });
    const router = express.Router();
    registerProfileRefreshStatusRoutes(router, { db });
    app.use('/api/libraries', router);
    app.use(errorHandler);
    return { app, db };
}

test('the read-only status requires an administrator and never caches or accepts query controls', async () => {
    const { app, db } = createApp();
    const denied = await request(app).get('/api/libraries/profile-refresh-status').expect(403);
    expect(denied.headers['cache-control']).toBe('no-store');
    expect(db.query).not.toHaveBeenCalled();

    const response = await request(app).get('/api/libraries/profile-refresh-status')
        .set('x-test-role', 'admin').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({ libraryCount: 0, libraries: [], windowTruncated: false });
    expect(db.query).toHaveBeenCalledTimes(1);

    await request(app).get('/api/libraries/profile-refresh-status?libraryId=1')
        .set('x-test-role', 'admin').expect(400);
    expect(db.query).toHaveBeenCalledTimes(1);
});
