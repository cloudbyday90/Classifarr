/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: 7, role: 'admin' };
    next();
  });
  app.use('/api/policies', policiesRouter);
  app.use(errorHandler);
  return app;
}

describe('Policy native intent conversion retirement', () => {
  test('does not register legacy manual preview or apply endpoints', async () => {
    const app = createApp();

    await request(app)
      .get('/api/policies/native-intent-conversions/preview')
      .expect(404);
    await request(app)
      .post('/api/policies/native-intent-conversions/apply')
      .send({ policy_ids: [14], confirmation: 'CONVERT_NATIVE_INTENT' })
      .expect(404);
  });
});
