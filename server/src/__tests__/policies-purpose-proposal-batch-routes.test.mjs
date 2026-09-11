/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const getProposal = jest.fn();
const applyProposal = jest.fn();

jest.unstable_mockModule('../services/policyPurposeProposalBatchService.mjs', () => ({
  policyPurposeProposalBatchService: { getProposal, applyProposal },
}));

const { registerPolicyPurposeProposalBatchRoutes } =
  await import('../routes/policiesRoutePolicyPurposeProposalBatch.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  const router = express.Router();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  registerPolicyPurposeProposalBatchRoutes(router, {
    db: { query: jest.fn(), withTransaction: jest.fn() },
    logger: { info: jest.fn() },
  });
  app.use('/api/policies', router);
  app.use(errorHandler);
  return app;
}

const requestBody = {
  proposal_fingerprint: `sha256:${'a'.repeat(64)}`,
  candidate_policy_ids: [7, 9],
};

describe('policy purpose proposal batch routes', () => {
  beforeEach(() => {
    getProposal.mockReset();
    applyProposal.mockReset();
    getProposal.mockResolvedValue({
      statusId: 'ready_for_apply',
      rawPurposeRulesExposed: false,
    });
    applyProposal.mockResolvedValue({
      statusId: 'applied',
      policyCount: 2,
      replayed: false,
      rawPurposeRulesExposed: false,
    });
  });

  test('reads the current batch as an administrator-only no-store response', async () => {
    const response = await request(createApp())
      .get('/api/policies/native-intent-reconciliation/purpose-proposals')
      .expect(200);

    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual(expect.objectContaining({ statusId: 'ready_for_apply' }));
    expect(getProposal).toHaveBeenCalledWith({ dbClient: expect.any(Object) });
    await request(createApp({ id: 8, role: 'operator' }))
      .get('/api/policies/native-intent-reconciliation/purpose-proposals')
      .expect(403);
  });

  test('forwards only the authenticated actor, opaque request, and valid idempotency key', async () => {
    await request(createApp())
      .post('/api/policies/native-intent-reconciliation/purpose-proposals/apply')
      .set('Idempotency-Key', `"${'b'.repeat(32)}"`)
      .send({ ...requestBody, actor_id: 999 })
      .expect(400);

    await request(createApp())
      .post('/api/policies/native-intent-reconciliation/purpose-proposals/apply')
      .set('Idempotency-Key', `"${'b'.repeat(32)}"`)
      .send(requestBody)
      .expect(200);

    expect(applyProposal).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      actorId: 7,
      actorRole: 'admin',
      idempotencyKey: 'b'.repeat(32),
      request: requestBody,
    });
  });

  test('fails stale batches closed and returns no success response', async () => {
    applyProposal.mockResolvedValueOnce({ statusId: 'proposal_stale', policyCount: 0 });

    await request(createApp())
      .post('/api/policies/native-intent-reconciliation/purpose-proposals/apply')
      .set('Idempotency-Key', 'b'.repeat(32))
      .send(requestBody)
      .expect(409);
  });
});
