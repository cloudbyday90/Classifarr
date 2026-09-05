/* Classifarr - Copyright (C) 2024-2026 Classifarr Contributors - GPL-3.0 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { createMediaIdentityReviewRouter } from '../routes/mediaIdentityReviewRouter.mjs';

const verifyToken = jest.fn();
jest.unstable_mockModule('../services/auth.mjs', () => ({ verifyToken }));
jest.unstable_mockModule('../config/runtimeSettings.mjs', () => ({ getValue: () => true }));
const { authenticateToken, requireAdmin } = await import('../middleware/auth.mjs');
const { csrfProtection } = await import('../middleware/csrf.mjs');
const service = { list: jest.fn(), preview: jest.fn(), confirm: jest.fn() };
const app = express();
app.use(express.json(), cookieParser());
app.use('/api', csrfProtection);
app.use('/api/media-identity-review', createMediaIdentityReviewRouter({ authenticateToken, requireAdmin, service }));
app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ error: error.message }));

beforeEach(() => {
  for (const mock of [verifyToken, ...Object.values(service)]) mock.mockReset();
  verifyToken.mockResolvedValue({ id: 7, role: 'admin', type: 'access' });
  service.list.mockResolvedValue({ items: [], nextCursor: null });
  service.preview.mockResolvedValue({ previewId: 'preview' });
  service.confirm.mockResolvedValue({ auditId: 9 });
});

describe('identity review HTTP authorization', () => {
  test('requires authentication before reading or writing', async () => {
    for (const endpoint of ['', '/1/preview', '/1/confirm']) {
      const call = endpoint ? request(app).post(`/api/media-identity-review${endpoint}`) : request(app).get('/api/media-identity-review');
      expect((await call).status).toBe(401);
    }
    expect(service.list).not.toHaveBeenCalled();
  });
  test.each([{ id: 7, type: 'access', role: 'user' }, { id: 7, type: 'refresh', role: 'admin' },
    { id: 7, type: 'access', role: 'admin', token_use: 'automation' }])('rejects non-human-admin session %j', async user => {
    verifyToken.mockResolvedValue(user);
    expect((await request(app).get('/api/media-identity-review').set('Authorization', 'Bearer test')).status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });
  test('rejects API-key bypass even alongside a valid cookie', async () => {
    const response = await request(app).post('/api/media-identity-review/1/confirm').set('Cookie', 'access_token=test').set('x-api-key', 'test');
    expect(response.status).toBe(403);
    expect(service.confirm).not.toHaveBeenCalled();
  });
  test('requires matching CSRF tokens for cookie mutations', async () => {
    expect((await request(app).post('/api/media-identity-review/1/confirm').set('Cookie', 'access_token=test')).status).toBe(403);
    const response = await request(app).post('/api/media-identity-review/1/confirm')
      .set('Cookie', 'access_token=test; classifarr_csrf_token=csrf-test').set('x-csrf-token', 'csrf-test')
      .send({ previewId: 'preview', confirmed: true });
    expect(response.status).toBe(200);
    expect(service.confirm).toHaveBeenCalledWith(7, '1', { previewId: 'preview', confirmed: true });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  test('passes query and preview fields to the validating service using the session actor', async () => {
    await request(app).get('/api/media-identity-review?mediaType=tv').set('Authorization', 'Bearer test').expect(200);
    await request(app).post('/api/media-identity-review/3/preview').set('Authorization', 'Bearer test').send({ tmdbId: 4, sourceVersion: 'v' }).expect(200);
    expect(service.list).toHaveBeenCalledWith(7, { mediaType: 'tv' });
    expect(service.preview).toHaveBeenCalledWith(7, '3', { tmdbId: 4, sourceVersion: 'v' });
  });
});
