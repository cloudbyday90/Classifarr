/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, expect, jest, test } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { createInventoryRecoveryRouter } from '../routes/inventoryRecoveryRouter.mjs';
const verifyToken = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
const { authenticateToken, requireAdmin } = await import('../middleware/auth.mjs');
const service = { list: jest.fn(), plexLink: jest.fn(), progress: jest.fn() };
const app = express();
app.use('/api/inventory-recovery', createInventoryRecoveryRouter({ authenticateToken, requireAdmin, service }));
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));
const paths = ['/api/inventory-recovery', '/api/inventory-recovery/1/56d6ff3b-21ee-457b-bf93-b3d2ef767b4b/plex-link', '/api/inventory-recovery/progress'];
beforeEach(() => {
    for (const mock of [verifyToken, ...Object.values(service)]) mock.mockReset();
    verifyToken.mockResolvedValue({ id: 7, role: 'admin', type: 'access' });
    service.list.mockResolvedValue({ items: [] }); service.plexLink.mockResolvedValue({ status: 'unavailable', url: null });
    service.progress.mockResolvedValue({ total: 0 });
});
test('anonymous reads are uncached and denied before any service query', async () => {
    for (const path of paths) {
        const response = await request(app).get(path).expect(401);
        expect(response.headers['cache-control']).toBe('no-store');
    }
    expect(service.list).not.toHaveBeenCalled(); expect(service.plexLink).not.toHaveBeenCalled();
});
test.each([{ role: 'user', type: 'access' }, { role: 'admin', type: 'refresh' },
    { role: 'admin', type: 'access', token_use: 'automation' }])('rejects session %j', async user => {
    verifyToken.mockResolvedValue({ id: 7, ...user });
    for (const path of paths) await request(app).get(path).set('Authorization', 'Bearer test').expect(403);
    expect(service.list).not.toHaveBeenCalled(); expect(service.plexLink).not.toHaveBeenCalled();
});
test('API keys cannot bypass the access session; supported reads bind the actor', async () => {
    await request(app).get(paths[0]).set('Authorization', 'Bearer test').set('x-api-key', 'key').expect(403);
    await request(app).get(`${paths[0]}?afterId=9`).set('Authorization', 'Bearer test').expect(200);
    expect(service.list).toHaveBeenCalledWith(7, { afterId: '9' });
    const result = await request(app).get(paths[1]).set('Authorization', 'Bearer test').expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(service.plexLink).toHaveBeenCalledWith(7, '1', '56d6ff3b-21ee-457b-bf93-b3d2ef767b4b', {});
    await request(app).post(paths[0]).set('Authorization', 'Bearer test').expect(404);
    await request(app).get(paths[2]).set('Authorization', 'Bearer test').expect(200);
    expect(service.progress).toHaveBeenCalledWith(7, {});
});
