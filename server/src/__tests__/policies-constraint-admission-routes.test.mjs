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
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyConstraintAdmissionRoutes,
} from '../routes/policiesRoutePolicyConstraintAdmission.mjs';
import {
  POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
} from '../services/policyConstraintWriteAdmission.mjs';
import {
  policyConstraintWriteAdmissionLimiterConfig,
} from '../config/rateLimits.mjs';

function buildPayload(command = {}) {
  return {
    version: POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_VERSION,
    command: {
      commandId: 'set_hard_limit',
      controlId: 'hard_limit',
      intentId: 'blocking_constraint',
      decisionEffectId: 'block_automatic_application',
      certificationSemanticId: 'max_allowed_rating',
      values: ['PG-13'],
      sourceId: 'operator_declared',
      explicitOperatorAction: true,
      inferredFromAbsence: false,
      ...command,
    },
  };
}

function createApp({
  rows = [{ id: 6, name: 'Animated Movies', media_type: 'movie' }],
  user = { id: 42, role: 'admin' },
} = {}) {
  const db = { query: jest.fn().mockResolvedValue({ rows }) };
  const logger = { info: jest.fn(), warn: jest.fn() };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();

  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyConstraintAdmissionRoutes(router, { db, logger, rateLimit });
  app.use('/api/policies', router);
  app.use(errorHandler);

  return { app, db, logger, rateLimit };
}

describe('policy constraint admission routes', () => {
  test('admits an eligible server-derived command without writing policy storage', async () => {
    const { app, db, logger, rateLimit } = createApp();

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/constraints/admission')
      .send(buildPayload())
      .expect(200);

    expect(rateLimit).toHaveBeenCalledWith(policyConstraintWriteAdmissionLimiterConfig);
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM libraries'), [6]);
    expect(response.body).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'admitted',
      admittedCommand: expect.objectContaining({
        commandId: 'set_hard_limit',
        values: ['PG-13'],
      }),
      authority: expect.objectContaining({ policyPersistence: false }),
      sideEffects: expect.objectContaining({ policyStorageMutated: false }),
    }));
    expect(response.body).not.toHaveProperty('nextStep');
    expect(logger.info).toHaveBeenCalledWith('Admitted policy constraint command without persistence', {
      libraryId: 6,
      controlId: 'hard_limit',
      statusId: 'admitted',
    });
  });

  test('rejects malformed command DTOs before reading the library or logging command values', async () => {
    const { app, db, logger } = createApp();

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/constraints/admission')
      .send({ ...buildPayload(), libraryId: 10 })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Constraint write admission request is invalid.',
      code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_INVALID',
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith('Rejected malformed policy constraint write admission', {
      libraryId: 6,
      code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_REQUEST_INVALID',
    });
  });

  test('rejects commands that no longer match active library eligibility without logging a value', async () => {
    const { app, db, logger } = createApp();

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/constraints/admission')
      .send(buildPayload({ values: ['TV-14'] }))
      .expect(409);

    expect(response.body).toEqual({
      error: 'Constraint command no longer matches the active library.',
      code: 'POLICY_CONSTRAINT_WRITE_ADMISSION_NOT_ELIGIBLE',
    });
    expect(db.query).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('Rejected policy constraint write admission', {
      libraryId: 6,
      statusId: 'command_not_eligible',
      riskId: 'command_value_not_eligible',
    });
  });

  test('requires an administrator even when the route is mounted without global policy middleware', async () => {
    const { app, db } = createApp({ user: { id: 17, role: 'operator' } });

    const response = await request(app)
      .post('/api/policies/operator-workflow/libraries/6/constraints/admission')
      .send(buildPayload())
      .expect(403);

    expect(response.body).toEqual({ error: 'Admin access required' });
    expect(db.query).not.toHaveBeenCalled();
  });
});
