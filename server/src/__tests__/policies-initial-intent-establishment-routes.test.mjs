import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';

const queryMock = jest.fn();
const withTransactionMock = jest.fn(async work => work({ query: queryMock }));
const applyPolicyInitialIntentEstablishmentMock = jest.fn();
const applyPolicyInitialIntentEstablishmentInTransactionMock = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/policyInitialIntentEstablishmentService.mjs', () => ({
  POLICY_INITIAL_INTENT_ESTABLISHMENT_RISK_IDS: {
    ACTOR_REQUIRED: 'actor_required',
    DECLARED_INTENT_INVALID: 'declared_intent_invalid',
  },
  POLICY_INITIAL_INTENT_ESTABLISHMENT_STATUS_IDS: {
    ESTABLISHED: 'initial_intent_established',
    REPLAYED: 'initial_intent_establishment_replayed',
    BLOCKED_BY_REQUEST: 'initial_intent_establishment_request_invalid',
    BLOCKED_BY_TRANSACTION_BOUNDARY: 'initial_intent_establishment_transaction_required',
    FAILED_ROLLED_BACK: 'initial_intent_establishment_failed_rolled_back',
  },
  applyPolicyInitialIntentEstablishmentInTransaction:
    applyPolicyInitialIntentEstablishmentInTransactionMock,
  applyPolicyInitialIntentEstablishment: applyPolicyInitialIntentEstablishmentMock,
}));

const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function successfulResult(overrides = {}) {
  return {
    statusId: 'initial_intent_established',
    policyId: 44,
    establishment: {
      applied: true,
      replayed: false,
      rawDeclaredIntentExposed: false,
    },
    validation: { ok: true, issueCount: 0, issues: [] },
    ...overrides,
  };
}

function createApp(user = { id: 7, role: 'admin' }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.use('/api/policies', policiesRouter);
  app.use(errorHandler);
  return app;
}

describe('Policy initial intent establishment route', () => {
  beforeEach(() => {
    queryMock.mockReset();
    withTransactionMock.mockReset();
    applyPolicyInitialIntentEstablishmentMock.mockReset();
    applyPolicyInitialIntentEstablishmentInTransactionMock.mockReset();
    withTransactionMock.mockImplementation(async work => work({ query: queryMock }));
    applyPolicyInitialIntentEstablishmentMock.mockResolvedValue(successfulResult());
  });

  test('uses the authenticated administrator as the establishment actor', async () => {
    const response = await request(createApp())
      .post('/api/policies/44/native-intent/initial-establishment')
      .send({
        schema_version: 1,
        idempotency_key: '6fe3d170-9390-4ec5-95f7-42ad6f8ec777',
        declared_intent: { purpose: [] },
        actor_id: 999,
        authority_source_id: 'legacy_preset',
      })
      .expect(201);

    expect(applyPolicyInitialIntentEstablishmentMock).toHaveBeenCalledWith(expect.objectContaining({
      policyId: '44',
      actorId: 7,
      request: expect.objectContaining({ actor_id: 999 }),
    }));
    expect(JSON.stringify(response.body)).not.toContain('declared_intent');
  });

  test('requires an administrator before establishing first native authority', async () => {
    await request(createApp({ id: 7, role: 'operator' }))
      .post('/api/policies/44/native-intent/initial-establishment')
      .send({})
      .expect(403);

    expect(applyPolicyInitialIntentEstablishmentMock).not.toHaveBeenCalled();
  });

  test('returns a bounded validation error for unsafe declared intent', async () => {
    applyPolicyInitialIntentEstablishmentMock.mockResolvedValue(successfulResult({
      statusId: 'initial_intent_establishment_request_invalid',
      establishment: { applied: false, replayed: false },
      validation: {
        ok: false,
        issueCount: 1,
        issues: [{ riskId: 'declared_intent_invalid', message: 'internal detail' }],
      },
    }));

    const response = await request(createApp())
      .post('/api/policies/44/native-intent/initial-establishment')
      .send({})
      .expect(400);

    expect(response.body.code).toBe('POLICY_INITIAL_INTENT_ESTABLISHMENT_REQUEST_INVALID');
    expect(JSON.stringify(response.body)).not.toContain('internal detail');
  });

  test('treats an idempotent replay as a successful bounded response', async () => {
    applyPolicyInitialIntentEstablishmentMock.mockResolvedValue(successfulResult({
      statusId: 'initial_intent_establishment_replayed',
      establishment: { applied: false, replayed: true },
    }));

    await request(createApp())
      .post('/api/policies/44/native-intent/initial-establishment')
      .send({})
      .expect(200);
  });
});
