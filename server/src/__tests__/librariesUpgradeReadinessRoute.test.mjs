/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/errorHandler.mjs';
import { registerUpgradeReadinessRoutes } from '../routes/librariesRouteUpgradeReadiness.mjs';

test('upgrade readiness is administrator-only, no-store, and rejects query controls', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rows: [{
        observed_at: '2026-09-23T12:00:00.000Z', library_count: 0, active_count: 0,
        movie_count: 0, tv_count: 0, other_count: 0, missing_profile_count: 0,
        current_count: 0, queued_count: 0, processing_count: 0, retry_wait_count: 0,
        cooldown_count: 0, waiting_count: 0, paused_count: 0, unverified_count: 0,
        no_inventory_count: 0, covered_count: 0, issue_count: 0, conflict_count: 0,
        invalid_provider_count: 0, invalid_type_count: 0, enrollment_recorded: false,
    }] }) };
    const app = express();
    app.use((req, _res, next) => { req.user = { role: req.get('x-test-role') || 'viewer' }; next(); });
    const router = express.Router();
    registerUpgradeReadinessRoutes(router, { db });
    app.use('/api/libraries', router);
    app.use(errorHandler);

    const denied = await request(app).get('/api/libraries/upgrade-readiness').expect(403);
    expect(denied.headers['cache-control']).toBe('no-store');
    expect(db.query).not.toHaveBeenCalled();
    const allowed = await request(app).get('/api/libraries/upgrade-readiness')
        .set('x-test-role', 'admin').expect(200);
    expect(allowed.headers['cache-control']).toBe('no-store');
    expect(allowed.body).toMatchObject({ libraryCount: 0, profile: { current: 0 } });
    await request(app).get('/api/libraries/upgrade-readiness?limit=100')
        .set('x-test-role', 'admin').expect(400);
    expect(db.query).toHaveBeenCalledTimes(1);
});
