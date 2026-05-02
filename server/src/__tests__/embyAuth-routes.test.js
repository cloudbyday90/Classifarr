/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const express = require('express');
const request = require('supertest');

jest.mock('../config/database', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (_req, _res, next) => next(),
}));

jest.mock('../services/embyAuth', () => ({
  authenticateWithPassword: jest.fn(),
  getServerInfo: jest.fn(),
  testConnection: jest.fn(),
  verifyToken: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const db = require('../config/database');
const embyAuth = require('../services/embyAuth');
const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};
const authenticateToken = (_req, _res, next) => next();

describe('emby auth routes', () => {
  let app;
  let client;

  beforeEach(async () => {
    jest.clearAllMocks();
    const { createEmbyAuthRouter } = await import('../routes/embyAuthRouteShared.mjs');
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    db.pool.connect.mockResolvedValue(client);
    app = express();
    app.use(express.json());
    app.use('/api/emby', createEmbyAuthRouter({
      express,
      embyAuth,
      db,
      authenticateToken,
      logger,
    }));
  });

  test('POST /api/emby/test validates serverUrl', async () => {
    const response = await request(app)
      .post('/api/emby/test')
      .send({})
      .expect(400);

    expect(response.body.error).toMatch(/serverUrl is required/i);
    expect(embyAuth.testConnection).not.toHaveBeenCalled();
  });

  test('POST /api/emby/authenticate requires username', async () => {
    const response = await request(app)
      .post('/api/emby/authenticate')
      .send({ serverUrl: 'http://emby.local' })
      .expect(400);

    expect(response.body.error).toMatch(/serverUrl and username are required/i);
    expect(embyAuth.authenticateWithPassword).not.toHaveBeenCalled();
  });

  test('POST /api/emby/verify requires token', async () => {
    const response = await request(app)
      .post('/api/emby/verify')
      .send({ serverUrl: 'http://emby.local' })
      .expect(400);

    expect(response.body.error).toMatch(/serverUrl and token are required/i);
    expect(embyAuth.verifyToken).not.toHaveBeenCalled();
  });

  test('POST /api/emby/verify returns service result', async () => {
    embyAuth.verifyToken.mockResolvedValueOnce({ valid: true });

    const response = await request(app)
      .post('/api/emby/verify')
      .send({ serverUrl: 'http://emby.local', token: 'token-1' })
      .expect(200);

    expect(response.body).toEqual({ valid: true });
    expect(embyAuth.verifyToken).toHaveBeenCalledWith('http://emby.local', 'token-1');
  });

  test('POST /api/emby/save saves server configuration', async () => {
    embyAuth.getServerInfo.mockResolvedValueOnce({ success: true, serverName: 'Emby Server' });
    client.query
      .mockResolvedValueOnce()
      .mockResolvedValueOnce()
      .mockResolvedValueOnce({
        rows: [{ id: 1, type: 'emby', name: 'Emby Server', url: 'http://emby.local', is_active: true }],
      })
      .mockResolvedValueOnce();

    const response = await request(app)
      .post('/api/emby/save')
      .send({ serverUrl: 'http://emby.local', token: 'token-1' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.query).toHaveBeenCalledWith('UPDATE media_server SET is_active = false');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
