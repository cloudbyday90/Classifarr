/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import { errorHandler } from '../middleware/errorHandler.mjs';
import {
  registerPolicyCandidateCorrectionPolicyChangeDecisionRecordRoutes,
} from '../routes/policiesRoutePolicyChangeDecisionRecord.mjs';

function response() {
  return {
    version: 'policy.candidate_correction_policy_change_decision_record.v1',
    statusId: 'review_ready',
    reviewAvailable: true,
    automaticPolicyChange: false,
    automaticAiRagTuning: false,
    routingChanged: false,
    observation: {
      hypothesisId: `pco_${'a'.repeat(32)}`,
      outcomeAvailableAt: '2026-08-30T00:00:00.000Z',
      expiresAt: '2026-09-29T00:00:00.000Z',
    },
    decision: null,
  };
}

function createApp({ user = { id: 7, role: 'admin' } } = {}) {
  const decisionRecordService = {
    getDecisionRecord: jest.fn().mockResolvedValue(response()),
    createDecisionRecord: jest.fn().mockResolvedValue(response()),
    reviseDecisionRecord: jest.fn().mockResolvedValue(response()),
  };
  const rateLimit = jest.fn(() => (_req, _res, next) => next());
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyCandidateCorrectionPolicyChangeDecisionRecordRoutes(router, {
    db: {},
    logger: { info: jest.fn() },
    rateLimit,
    decisionRecordService,
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return { app, decisionRecordService, rateLimit };
}

describe('policy-change decision record routes', () => {
  test('requires an administrator and returns a no-store selector-free status', async () => {
    const { app, decisionRecordService, rateLimit } = createApp();
    const result = await request(app)
      .get('/api/policies/candidate-correction/policy-change-decision-record')
      .expect(200);

    expect(result.headers['cache-control']).toBe('no-store');
    expect(decisionRecordService.getDecisionRecord).toHaveBeenCalledWith({ actorId: 7 });
    expect(rateLimit).toHaveBeenCalledTimes(2);

    await request(createApp({ user: { id: 8, role: 'operator' } }).app)
      .get('/api/policies/candidate-correction/policy-change-decision-record')
      .expect(403);
  });

  test('accepts only a fixed create body and never forwards caller selectors', async () => {
    const { app, decisionRecordService } = createApp();

    await request(app)
      .post('/api/policies/candidate-correction/policy-change-decision-record?policyId=1')
      .send({ decision_id: 'retain_current_policy', rationale_id: 'outcome_improved' })
      .expect(400);
    await request(app)
      .post('/api/policies/candidate-correction/policy-change-decision-record')
      .send({ decision_id: 'retain_current_policy', rationale_id: 'outcome_improved', policyId: 1 })
      .expect(400);
    expect(decisionRecordService.createDecisionRecord).not.toHaveBeenCalled();

    const result = await request(app)
      .post('/api/policies/candidate-correction/policy-change-decision-record')
      .send({ decision_id: 'retain_current_policy', rationale_id: 'outcome_improved' })
      .expect(201);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(decisionRecordService.createDecisionRecord).toHaveBeenCalledWith({
      actorId: 7,
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
    });
  });

  test('requires an explicit expected revision for a revision request', async () => {
    const { app, decisionRecordService } = createApp();

    await request(app)
      .put('/api/policies/candidate-correction/policy-change-decision-record')
      .send({ decision_id: 'retain_current_policy', rationale_id: 'outcome_improved' })
      .expect(400);
    expect(decisionRecordService.reviseDecisionRecord).not.toHaveBeenCalled();

    await request(app)
      .put('/api/policies/candidate-correction/policy-change-decision-record')
      .send({
        decision_id: 'retain_current_policy',
        rationale_id: 'outcome_improved',
        expected_revision: 1,
      })
      .expect(200);
    expect(decisionRecordService.reviseDecisionRecord).toHaveBeenCalledWith({
      actorId: 7,
      decisionId: 'retain_current_policy',
      rationaleId: 'outcome_improved',
      expectedRevision: 1,
    });
  });
});
