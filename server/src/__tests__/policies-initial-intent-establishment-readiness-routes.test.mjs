import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';

const queryMock = jest.fn();
const withTransactionMock = jest.fn(async work => work({ query: queryMock }));
const getPolicyInitialIntentEstablishmentReadinessMock = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/policyInitialIntentEstablishmentReadinessContract.mjs', () => ({
  POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_STATUS_IDS: {
    READY: 'initial_intent_establishment_ready',
    POLICY_NOT_FOUND: 'initial_intent_establishment_policy_not_found',
    READ_UNAVAILABLE: 'initial_intent_establishment_read_unavailable',
  },
}));

jest.unstable_mockModule('../services/policyInitialIntentEstablishmentReadinessService.mjs', () => ({
  getPolicyInitialIntentEstablishmentReadiness: getPolicyInitialIntentEstablishmentReadinessMock,
}));

const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function successfulResult(overrides = {}) {
  return {
    version: 1,
    statusId: 'initial_intent_establishment_ready',
    policyId: 44,
    eligibility: { canEstablishInitialIntent: true, blockers: [] },
    establishmentHistory: {
      recovery: { stateId: 'not_applicable' },
    },
    sideEffects: { readOnly: true, automationStarted: false },
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

describe('Policy initial intent establishment readiness route', () => {
  beforeEach(() => {
    queryMock.mockReset();
    withTransactionMock.mockReset();
    getPolicyInitialIntentEstablishmentReadinessMock.mockReset();
    withTransactionMock.mockImplementation(async work => work({ query: queryMock }));
    getPolicyInitialIntentEstablishmentReadinessMock.mockResolvedValue(successfulResult());
  });

  test('returns the server-owned, read-only readiness surface for an administrator', async () => {
    const response = await request(createApp())
      .get('/api/policies/44/native-intent/initial-establishment/readiness')
      .expect(200);

    expect(getPolicyInitialIntentEstablishmentReadinessMock).toHaveBeenCalledWith({
      dbClient: expect.objectContaining({ query: expect.any(Function) }),
      policyId: '44',
    });
    expect(response.body).toEqual(expect.objectContaining({
      policyId: 44,
      eligibility: { canEstablishInitialIntent: true, blockers: [] },
      sideEffects: { readOnly: true, automationStarted: false },
    }));
  });

  test('requires administrator access before reading establishment history', async () => {
    await request(createApp({ id: 7, role: 'operator' }))
      .get('/api/policies/44/native-intent/initial-establishment/readiness')
      .expect(403);

    expect(getPolicyInitialIntentEstablishmentReadinessMock).not.toHaveBeenCalled();
  });

  test('returns a bounded not-found response', async () => {
    getPolicyInitialIntentEstablishmentReadinessMock.mockResolvedValue(successfulResult({
      statusId: 'initial_intent_establishment_policy_not_found',
      policyId: null,
    }));

    const response = await request(createApp())
      .get('/api/policies/999/native-intent/initial-establishment/readiness')
      .expect(404);

    expect(response.body.error).toBe('Policy not found');
  });

  test('returns a bounded retry response when readiness storage is unavailable', async () => {
    getPolicyInitialIntentEstablishmentReadinessMock.mockResolvedValue(successfulResult({
      statusId: 'initial_intent_establishment_read_unavailable',
      policyId: 44,
      internalError: 'never expose this',
    }));

    const response = await request(createApp())
      .get('/api/policies/44/native-intent/initial-establishment/readiness')
      .expect(503);

    expect(response.body.code).toBe('POLICY_INITIAL_INTENT_ESTABLISHMENT_READINESS_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('never expose this');
  });
});
