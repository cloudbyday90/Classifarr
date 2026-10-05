/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp, shouldSkipAccessLog } from '../bootstrap/createApp.mjs';

function createRouter(handler) {
  const router = express.Router();
  handler(router);
  return router;
}

describe('createApp', () => {
  let database;
  let runtimeSettings;
  let ensureCsrfCookie;
  let csrfProtection;
  let evaluateCorsOrigin;
  let generateSwaggerSpec;
  let apiRouter;
  let authRouter;
  let setupRouter;
  let systemRouter;
  let userRouter;
  let swaggerUi;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSecurityHeadersStrict = process.env.SECURITY_HEADERS_STRICT;
  const originalEnforceHttpsHeaders = process.env.ENFORCE_HTTPS_HEADERS;

  it.each([
    ['key=synthetic_query_secret', 200],
    ['%6b%65%79=synthetic_query_secret', 200],
    ['key=synthetic%5Fquery%5Fsecret', 200],
    ['key=synthetic_query_secret&key=other', 401],
    ['key[]=synthetic_query_secret', 401],
    ['key=synthetic_query_secret%ZZ', 401],
  ])('redacts real access output without changing query authentication: %s', async (query, status) => {
    const previous = process.env.CLASSIFARR_TEST_ACCESS_LOGS;
    process.env.CLASSIFARR_TEST_ACCESS_LOGS = '1';
    const lines = [];
    const output = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    try {
      apiRouter = createRouter((router) => {
        router.post('/webhook/request', (req, res) => {
          res.status(req.query.key === 'synthetic_query_secret' ? 200 : 401).json({
            originalUrl: req.originalUrl, query: req.query,
          });
        });
      });
      const app = await createApp({
        database, runtimeSettings, port: 21324, apiRouter, authRouter, setupRouter,
        systemRouter, userRouter, swaggerUi, ensureCsrfCookie, csrfProtection,
        generateSwaggerSpec, evaluateCorsOrigin,
      });
      const url = `/api/webhook/request?${query}`;
      const response = await request(app).post(url)
        .set('Referer', 'https://user:synthetic_referrer_secret@example.test/settings?key=synthetic_referrer_secret#synthetic_fragment_secret')
        .set('User-Agent', 'safe"agent\\value');
      expect(response.status).toBe(status);
      expect(response.body.originalUrl).toBe(url);
      if (status === 200) expect(response.body.query.key).toBe('synthetic_query_secret');
      const log = lines.join('');
      expect(log).toContain(`"POST /api/webhook/request HTTP/1.1" ${status}`);
      expect(log).toContain('https://example.test/settings');
      expect(log).not.toMatch(/synthetic|%5F|\?key|%6b/i);
      expect(log).toContain('safe\\"agent\\\\value');
    } finally {
      output.mockRestore();
      if (previous === undefined) delete process.env.CLASSIFARR_TEST_ACCESS_LOGS;
      else process.env.CLASSIFARR_TEST_ACCESS_LOGS = previous;
    }
  });

  const buildTestApp = () => createApp({
    database, runtimeSettings, port: 21324, apiRouter, authRouter, setupRouter,
    systemRouter, userRouter, swaggerUi, ensureCsrfCookie, csrfProtection,
    generateSwaggerSpec, evaluateCorsOrigin,
    accessLogMiddleware: (_req, _res, next) => next(),
  });

  beforeEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecurityHeadersStrict === undefined) {
      delete process.env.SECURITY_HEADERS_STRICT;
    } else {
      process.env.SECURITY_HEADERS_STRICT = originalSecurityHeadersStrict;
    }
    if (originalEnforceHttpsHeaders === undefined) {
      delete process.env.ENFORCE_HTTPS_HEADERS;
    } else {
      process.env.ENFORCE_HTTPS_HEADERS = originalEnforceHttpsHeaders;
    }
    database = {
      query: jest.fn().mockResolvedValue(),
    };

    runtimeSettings = {
      getCorsOriginsList: jest.fn().mockReturnValue(['http://localhost:3000']),
    };

    ensureCsrfCookie = jest.fn((req, res, next) => {
      res.set('X-Test-Csrf-Cookie', '1');
      next();
    });

    csrfProtection = jest.fn((_req, _res, next) => next());
    evaluateCorsOrigin = jest.fn(() => ({ reject: false, value: true }));
    generateSwaggerSpec = jest.fn(() => ({ openapi: '3.0.0' }));
    apiRouter = createRouter((router) => {
      router.get('/ping', (_req, res) => res.json({ ok: true }));
    });
    authRouter = createRouter((router) => {
      router.get('/status', (_req, res) => res.json({ route: 'auth' }));
    });
    setupRouter = createRouter((router) => {
      router.get('/status', (_req, res) => res.json({ route: 'setup' }));
    });
    systemRouter = createRouter((router) => {
      router.get('/status', (_req, res) => res.json({ route: 'system' }));
    });
    userRouter = createRouter((router) => {
      router.get('/status', (_req, res) => res.json({ route: 'user' }));
    });

    swaggerUi = {
      serve: (_req, _res, next) => next(),
      setup: () => (_req, res) => res.status(200).json({ docs: true }),
    };
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalSecurityHeadersStrict === undefined) {
      delete process.env.SECURITY_HEADERS_STRICT;
    } else {
      process.env.SECURITY_HEADERS_STRICT = originalSecurityHeadersStrict;
    }
    if (originalEnforceHttpsHeaders === undefined) {
      delete process.env.ENFORCE_HTTPS_HEADERS;
    } else {
      process.env.ENFORCE_HTTPS_HEADERS = originalEnforceHttpsHeaders;
    }
  });

  it('mounts api routes and applies csrf cookie middleware', async () => {
    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/api/ping');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers['x-test-csrf-cookie']).toBe('1');
    expect(ensureCsrfCookie).toHaveBeenCalled();
    expect(csrfProtection).toHaveBeenCalled();
  });

  it.each([
    ['get', '/api/unknown'], ['post', '/api/unknown'], ['put', '/api/unknown'],
    ['patch', '/api/unknown'], ['delete', '/api/unknown'], ['get', '/API/unknown'],
    ['get', '/api/unknown/?private=value'], ['get', '/api/%2funknown'],
    ['get', '/api//unknown'],
  ])('returns a generic JSON 404 for unknown %s %s', async (method, pathname) => {
    process.env.NODE_ENV = 'production';
    const response = await request(await buildTestApp())[method](pathname);

    expect(response.status).toBe(404);
    expect(response.type).toBe('application/json');
    expect(response.body).toEqual({ error: 'Not Found' });
    expect(response.text).not.toContain('unknown');
    expect(response.text).not.toContain('private');
  });

  it('keeps HEAD bodyless and leaves CORS OPTIONS handling intact', async () => {
    const app = await buildTestApp();
    const head = await request(app).head('/api/unknown');
    expect(head.status).toBe(404);
    expect(head.type).toBe('application/json');
    expect(head.text).toBeUndefined();
    const options = await request(app).options('/api/unknown')
      .set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'POST');
    expect(options.status).toBe(204);
  });

  it('preserves registered API, documentation, health and authorization responses', async () => {
    apiRouter.get('/', (_req, res) => res.json({ name: 'Classifarr API' }));
    apiRouter.use('/protected', (_req, res) => res.status(401).json({ error: 'Authentication required' }));
    const app = await buildTestApp();
    expect((await request(app).get('/api')).body).toEqual({ name: 'Classifarr API' });
    expect((await request(app).get('/api/ping')).body).toEqual({ ok: true });
    expect((await request(app).get('/api/docs')).body).toEqual({ docs: true });
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/api/protected/unknown')).status).toBe(401);
  });

  it('preserves CSRF and malformed JSON rejection before API fallthrough', async () => {
    csrfProtection = jest.fn((req, res, next) => req.cookies.access_token
      ? res.status(403).json({ error: 'CSRF validation failed' }) : next());
    const app = await buildTestApp();
    const csrf = await request(app).post('/api/unknown').set('Cookie', 'access_token=synthetic');
    expect(csrf.status).toBe(403);
    expect(csrf.body).toEqual({ error: 'CSRF validation failed' });
    expect((await request(app).post('/api/unknown').set('Content-Type', 'application/json').send('{')).status).toBe(400);
  });

  it('uses the injected database for the health check route', async () => {
    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/health');

    expect(database.query).toHaveBeenCalledWith('SELECT 1');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.database).toBe('connected');
  });

  it('returns unhealthy when the health query fails', async () => {
    database.query.mockRejectedValueOnce(new Error('db down'));

    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.error).toBe('db down');
  });

  it('hides raw database errors from the health route in production', async () => {
    process.env.NODE_ENV = 'production';
    database.query.mockRejectedValueOnce(new Error('db down'));

    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/health');

    expect(response.status).toBe(500);
    expect(response.body.status).toBe('unhealthy');
    expect(response.body.error).toBe('Database connection failed');
  });

  it('sets a CSP without unsafe inline scripts', async () => {
    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/api/ping');
    const cspHeader = response.headers['content-security-policy'];

    expect(cspHeader).toContain("script-src 'self'");
    expect(cspHeader).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('does not emit cross-origin isolation headers by default for HTTP-compatible LAN access', async () => {
    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/api/ping');

    expect(response.headers['cross-origin-opener-policy']).toBeUndefined();
    expect(response.headers['origin-agent-cluster']).toBeUndefined();
  });

  it('emits cross-origin isolation headers when HTTPS header enforcement is enabled', async () => {
    process.env.ENFORCE_HTTPS_HEADERS = 'true';
    process.env.SECURITY_HEADERS_STRICT = 'true';

    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec,
      evaluateCorsOrigin,
    });
    const response = await request(app).get('/api/ping');

    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['origin-agent-cluster']).toBe('?1');
  });

  it('awaits an async generateSwaggerSpec function', async () => {
    const asyncGenerateSwaggerSpec = jest.fn().mockResolvedValue({ openapi: '3.0.0', paths: {} });

    const app = await createApp({
      database,
      runtimeSettings,
      port: 21324,
      apiRouter,
      authRouter,
      setupRouter,
      systemRouter,
      userRouter,
      swaggerUi,
      ensureCsrfCookie,
      csrfProtection,
      generateSwaggerSpec: asyncGenerateSwaggerSpec,
      evaluateCorsOrigin,
    });

    expect(asyncGenerateSwaggerSpec).toHaveBeenCalled();
    const response = await request(app).get('/api/ping');
    expect(response.status).toBe(200);
  });

  describe('shouldSkipAccessLog', () => {
    it('skips successful health checks', () => {
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/health' },
        { statusCode: 200 },
      )).toBe(true);
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/api/system/health' },
        { statusCode: 304 },
      )).toBe(true);
    });

    it('preserves unhealthy health check logs', () => {
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/health' },
        { statusCode: 500 },
      )).toBe(false);
    });

    it('skips notification poll cache revalidation noise', () => {
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/api/notifications' },
        { statusCode: 304 },
      )).toBe(true);
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/api/notifications/unread-count' },
        { statusCode: 304 },
      )).toBe(true);
    });

    it('preserves actionable notification traffic', () => {
      expect(shouldSkipAccessLog(
        { method: 'GET', path: '/api/notifications' },
        { statusCode: 200 },
      )).toBe(false);
      expect(shouldSkipAccessLog(
        { method: 'POST', path: '/api/notifications/mark-all-read' },
        { statusCode: 200 },
      )).toBe(false);
    });
  });
});
