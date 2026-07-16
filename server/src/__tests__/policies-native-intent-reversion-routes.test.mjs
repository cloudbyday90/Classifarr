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

const queryMock = jest.fn();
const withTransactionMock = jest.fn(async work => work({ query: queryMock }));
const applyPolicyNativeIntentReversionMock = jest.fn();
const approvePolicyReentryMock = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/policyNativeIntentReversionService.mjs', () => ({
  POLICY_NATIVE_INTENT_REVERSION_RISK_IDS: {
    ACTION_ACTOR_INVALID: 'action_actor_invalid',
    ACTION_REASON_INVALID: 'action_reason_invalid',
    POLICY_NOT_FOUND: 'policy_not_found',
    SNAPSHOT_NOT_FOUND: 'snapshot_not_found',
  },
  POLICY_NATIVE_INTENT_REVERSION_STATUS_IDS: {
    APPLIED_TO_COMPATIBILITY: 'applied_to_compatibility',
    APPLIED_TO_PREVIOUS_NATIVE_INTENT: 'applied_to_previous_native_intent',
    ALREADY_REVERTED: 'already_reverted',
    BLOCKED_BY_TRANSACTION_BOUNDARY: 'blocked_by_transaction_boundary',
    FAILED_ROLLED_BACK: 'failed_rolled_back',
  },
  applyPolicyNativeIntentReversion: applyPolicyNativeIntentReversionMock,
}));

jest.unstable_mockModule('../services/nativeIntentReconciliationLifecycleService.mjs', () => ({
  nativeIntentReconciliationLifecycleService: {
    approvePolicyReentry: approvePolicyReentryMock,
  },
}));

const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function successfulResult(overrides = {}) {
  return {
    statusId: 'applied_to_compatibility',
    policyId: 44,
    snapshotId: 901,
    reversion: { applied: true, rawSnapshotExposed: false },
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

describe('Policy native intent reversion route', () => {
  beforeEach(() => {
    queryMock.mockReset();
    withTransactionMock.mockReset();
    applyPolicyNativeIntentReversionMock.mockReset();
    approvePolicyReentryMock.mockReset();
    withTransactionMock.mockImplementation(async work => work({ query: queryMock }));
    applyPolicyNativeIntentReversionMock.mockResolvedValue(successfulResult());
    approvePolicyReentryMock.mockResolvedValue({
      approved: true,
      policyId: 44,
      reasonId: 'reconciliation_reentry_approved',
      rawPayloadExposed: false,
    });
  });

  test('derives the operator authority on the server and returns a bounded success', async () => {
    const response = await request(createApp())
      .post('/api/policies/44/native-intent-rollbacks/901/apply')
      .send({
        reason_code: 'operator_requested_reversion',
        actor_source_id: 'maintainer_migration_tool',
        actor_id: 999,
        snapshot_payload: { secret: 'ignored' },
      })
      .expect(200);

    expect(applyPolicyNativeIntentReversionMock).toHaveBeenCalledWith(expect.objectContaining({
      policyId: '44',
      snapshotId: '901',
      action: {
        actorSourceId: 'manual_operator',
        actorId: 7,
        reasonCode: 'operator_requested_reversion',
      },
    }));
    expect(JSON.stringify(response.body)).not.toContain('ignored');
  });

  test('requires an administrator route context before executing reversion', async () => {
    const response = await request(createApp({ id: 7, role: 'operator' }))
      .post('/api/policies/44/native-intent-rollbacks/901/apply')
      .send({ reason_code: 'operator_requested_reversion' })
      .expect(403);

    expect(response.body.error).toBe('Admin access required');
    expect(applyPolicyNativeIntentReversionMock).not.toHaveBeenCalled();
  });

  test('returns a bounded conflict when the final transaction check blocks reversion', async () => {
    applyPolicyNativeIntentReversionMock.mockResolvedValue(successfulResult({
      statusId: 'blocked_by_authority',
      reversion: { applied: false, rawSnapshotExposed: false },
      validation: {
        ok: false,
        issueCount: 1,
        issues: [{
          riskId: 'authority_mismatch',
          message: 'Current native authority is not the direct successor of the rollback snapshot.',
        }],
      },
    }));

    const response = await request(createApp())
      .post('/api/policies/44/native-intent-rollbacks/901/apply')
      .send({ reason_code: 'operator_requested_reversion' })
      .expect(409);

    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_REVERSION_BLOCKED');
    expect(JSON.stringify(response.body)).not.toContain('legacy_policy');
  });

  test('returns an availability response when the transaction is rolled back', async () => {
    applyPolicyNativeIntentReversionMock.mockResolvedValue(successfulResult({
      statusId: 'failed_rolled_back',
      reversion: { applied: false, rawSnapshotExposed: false },
      validation: {
        ok: false,
        issueCount: 1,
        issues: [{ riskId: 'transaction_failed', message: 'internal persistence detail' }],
      },
    }));

    const response = await request(createApp())
      .post('/api/policies/44/native-intent-rollbacks/901/apply')
      .send({ reason_code: 'operator_requested_reversion' })
      .expect(503);

    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_REVERSION_UNAVAILABLE');
    expect(JSON.stringify(response.body)).not.toContain('internal persistence detail');
  });

  test('derives re-entry authority on the server and does not trust client actor fields', async () => {
    const response = await request(createApp())
      .post('/api/policies/44/native-intent-reconciliation/reentry')
      .send({
        reason_code: 'operator_reviewed',
        actor_source_id: 'maintainer_migration_tool',
        actor_id: 999,
      })
      .expect(200);

    expect(approvePolicyReentryMock).toHaveBeenCalledWith(expect.objectContaining({
      policyId: '44',
      action: {
        actorSourceId: 'manual_operator',
        actorId: 7,
        reasonCode: 'operator_reviewed',
      },
    }));
    expect(response.body).toEqual(expect.objectContaining({
      approved: true,
      policyId: 44,
    }));
  });

  test('does not release a reconciliation hold for a non-administrator', async () => {
    const response = await request(createApp({ id: 7, role: 'operator' }))
      .post('/api/policies/44/native-intent-reconciliation/reentry')
      .send({ reason_code: 'operator_reviewed' })
      .expect(403);

    expect(response.body.error).toBe('Admin access required');
    expect(approvePolicyReentryMock).not.toHaveBeenCalled();
  });
});
