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
import { createApp } from '../bootstrap/createApp.mjs';

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

  beforeEach(() => {
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
});
