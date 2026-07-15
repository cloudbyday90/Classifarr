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

import { createLoggerModuleMock } from './helpers/mockFactory.mjs';

const queryMock = jest.fn();
const withTransactionMock = jest.fn(async work => work({ query: queryMock }));
const previewPolicyNativeIntentConversionMock = jest.fn();
const applyPolicyNativeIntentConversionMock = jest.fn();

jest.unstable_mockModule('../config/database.mjs', () => ({
  query: queryMock,
  withTransaction: withTransactionMock,
}));

jest.unstable_mockModule('../utils/logger.mjs', () => createLoggerModuleMock().module);

jest.unstable_mockModule('../services/policyNativeIntentConversionOperatorAction.mjs', () => ({
  POLICY_NATIVE_INTENT_CONVERSION_OPERATOR_ACTION_STATUS_IDS: {
    PREVIEW_READY: 'preview_ready',
    APPLIED: 'applied',
    ALREADY_CURRENT: 'already_current',
    BLOCKED_BY_REQUEST: 'blocked_by_request',
    BLOCKED_BY_SELECTION: 'blocked_by_selection',
    BLOCKED_BY_DRY_RUN: 'blocked_by_dry_run',
    FAILED_ROLLED_BACK: 'failed_rolled_back',
  },
  previewPolicyNativeIntentConversion: previewPolicyNativeIntentConversionMock,
  applyPolicyNativeIntentConversion: applyPolicyNativeIntentConversionMock,
}));

const { router: policiesRouter } = await import('../routes/policies.mjs');
const { errorHandler } = await import('../middleware/errorHandler.mjs');

function successResult(overrides = {}) {
  return {
    statusId: 'applied',
    summary: {
      requestedPolicyCount: 1,
      appliedPolicyCount: 1,
      alreadyConvertedCount: 0,
    },
    sideEffects: {
      nativeRowsInserted: true,
      migrationEventsWritten: true,
      rollbackSnapshotsWritten: true,
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

describe('Policy native intent conversion routes', () => {
  beforeEach(() => {
    queryMock.mockReset();
    withTransactionMock.mockReset();
    previewPolicyNativeIntentConversionMock.mockReset();
    applyPolicyNativeIntentConversionMock.mockReset();
    withTransactionMock.mockImplementation(async work => work({ query: queryMock }));
    previewPolicyNativeIntentConversionMock.mockResolvedValue({
      statusId: 'preview_ready',
      candidateReport: { rawLegacyJsonIncluded: false },
    });
    applyPolicyNativeIntentConversionMock.mockResolvedValue(successResult());
  });

  test('returns an administrator-only conversion preview', async () => {
    const response = await request(createApp())
      .get('/api/policies/native-intent-conversions/preview')
      .expect(200);

    expect(response.body.statusId).toBe('preview_ready');
    expect(previewPolicyNativeIntentConversionMock).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
    });
  });

  test('derives the operator identity server-side for apply', async () => {
    await request(createApp())
      .post('/api/policies/native-intent-conversions/apply')
      .send({
        policy_ids: [14],
        confirmation: 'CONVERT_NATIVE_INTENT',
        actor_id: 999,
        actor_source_id: 'maintainer_migration_tool',
      })
      .expect(200);

    expect(applyPolicyNativeIntentConversionMock).toHaveBeenCalledWith({
      dbClient: expect.any(Object),
      action: {
        actorId: 7,
        policyIds: [14],
        confirmation: 'CONVERT_NATIVE_INTENT',
      },
    });
  });

  test('requires an administrator for preview and apply', async () => {
    await request(createApp({ id: 7, role: 'operator' }))
      .get('/api/policies/native-intent-conversions/preview')
      .expect(403);
    await request(createApp({ id: 7, role: 'operator' }))
      .post('/api/policies/native-intent-conversions/apply')
      .send({ policy_ids: [14], confirmation: 'CONVERT_NATIVE_INTENT' })
      .expect(403);

    expect(previewPolicyNativeIntentConversionMock).not.toHaveBeenCalled();
    expect(applyPolicyNativeIntentConversionMock).not.toHaveBeenCalled();
  });

  test('returns only bounded validation details when the service rejects a request', async () => {
    applyPolicyNativeIntentConversionMock.mockResolvedValue(successResult({
      statusId: 'blocked_by_request',
      validation: {
        ok: false,
        issueCount: 1,
        issues: [{ riskId: 'confirmation_required', message: 'confirmation required' }],
      },
      legacyPolicy: { customSignals: { secret: 'must not return' } },
    }));

    const response = await request(createApp())
      .post('/api/policies/native-intent-conversions/apply')
      .send({ policy_ids: [14], confirmation: 'wrong' })
      .expect(400);

    expect(response.body.code).toBe('POLICY_NATIVE_INTENT_CONVERSION_REQUEST_INVALID');
    expect(response.body.issues).toEqual([
      expect.objectContaining({ riskId: 'confirmation_required' }),
    ]);
    expect(JSON.stringify(response.body)).not.toContain('must not return');
  });
});
