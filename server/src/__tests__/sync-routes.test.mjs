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

const getStatus = jest.fn();
const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../services/syncStatus.mjs', () => ({
  default: {
    getStatus,
  },
}));

jest.unstable_mockModule('../utils/logger.js', () => ({
  default: {
    createLogger: () => logger,
  },
}));

jest.unstable_mockModule('../utils/logger.mjs', () => ({
  default: {
    createLogger: () => logger,
  },
}));

const { default: syncRouter } = await import('../routes/sync.mjs');

describe('sync routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sync', syncRouter);
  });

  test('GET /api/sync/status returns sync status', async () => {
    getStatus.mockReturnValueOnce({ isRunning: false, progress: 0 });

    const response = await request(app)
      .get('/api/sync/status')
      .expect(200);

    expect(response.body).toEqual({ isRunning: false, progress: 0 });
  });

  test('GET /api/sync/status returns 500 on error', async () => {
    getStatus.mockImplementationOnce(() => {
      throw new Error('status failed');
    });

    const response = await request(app)
      .get('/api/sync/status')
      .expect(500);

    expect(response.body).toEqual({ error: 'status failed' });
    expect(logger.error).toHaveBeenCalledWith('Failed to get sync status', { error: 'status failed' });
  });
});
