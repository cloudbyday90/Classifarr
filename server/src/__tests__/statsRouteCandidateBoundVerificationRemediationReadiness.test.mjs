/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import { describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  registerCandidateBoundVerificationRemediationReadinessRoutes,
} from '../routes/statsRouteCandidateBoundVerificationRemediationReadiness.mjs';

function allowAdministrator(_req, _res, next) {
  next();
}

function denyAdministrator(_req, res) {
  res.status(403).json({ error: 'Admin access required' });
}

describe('statsRouteCandidateBoundVerificationRemediationReadiness', () => {
  test('returns the bounded report only after administrator authorization', async () => {
    const getReport = jest.fn().mockResolvedValue({
      version: 'classification.candidate_bound_verification_remediation_readiness.v1',
      providerAdmission: { admitted: true },
    });
    const app = express();
    const router = express.Router();
    registerCandidateBoundVerificationRemediationReadinessRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: allowAdministrator,
      createReadinessService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    const response = await request(app)
      .get('/api/stats/candidate-bound-verification/remediation-readiness?days=14')
      .expect(200);

    expect(response.body).toMatchObject({ providerAdmission: { admitted: true } });
    expect(getReport).toHaveBeenCalledWith({ windowDays: 14 });
  });

  test('does not instantiate or execute the readiness report for non-administrators', async () => {
    const getReport = jest.fn();
    const app = express();
    const router = express.Router();
    registerCandidateBoundVerificationRemediationReadinessRoutes(router, {
      db: { query: jest.fn() },
      requireAdmin: denyAdministrator,
      createReadinessService: () => ({ getReport }),
    });
    app.use('/api/stats', router);

    await request(app)
      .get('/api/stats/candidate-bound-verification/remediation-readiness')
      .expect(403);

    expect(getReport).not.toHaveBeenCalled();
  });

  test('requires an administrator authorization middleware at registration time', () => {
    expect(() => registerCandidateBoundVerificationRemediationReadinessRoutes(
      express.Router(),
      { db: {} },
    )).toThrow('requires administrator authorization');
  });
});
