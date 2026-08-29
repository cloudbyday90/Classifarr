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
import { beforeAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';

import {
  buildFixtureMetadata,
  FIXTURE_TAG,
  PRIVATE_FIXTURE_VALUE,
  subtractCounts,
  withRollbackTransaction,
} from './classificationDecisionPathTelemetryTestSupport.mjs';
import {
  createIntegrationDatabaseModuleMock,
  createIntegrationTestApp,
  getPool,
} from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { QueueReadModel } = await import('../../services/queueReadModel.mjs');
const {
  createClassificationDecisionPathTelemetryService,
} = await import('../../services/classificationDecisionPathTelemetryService.mjs');
const { createQueueRouter } = await import('../../routes/queueRouteShared.mjs');

const TEST_AUTHORIZATION = 'Bearer queue-live-stats-route-test';

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function createAuthenticationMiddleware() {
  return jest.fn((req, res, next) => {
    if (req.get('authorization') !== TEST_AUTHORIZATION) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = { id: 'queue-live-stats-route-test', role: 'admin' };
    return next();
  });
}

function createTransactionScopedQueueServiceAdapter(queueReadModel) {
  const getLiveStats = jest.fn(async () => Object.freeze({
    queue: await queueReadModel.getStats(),
  }));

  return Object.freeze({ getLiveStats });
}

async function seedTelemetryFixture(client, createdAt) {
  await client.query(
    `INSERT INTO task_queue (task_type, status, priority, payload)
     VALUES ('classification', 'pending', 1, $1::jsonb)`,
    [JSON.stringify({
      fixture_tag: FIXTURE_TAG,
      fixture_private_value: PRIVATE_FIXTURE_VALUE,
    })],
  );
  await client.query(
    `INSERT INTO classification_history
       (title, media_type, method, status, metadata, created_at)
     VALUES
       ($1, 'movie', 'policy_auto', 'routed', $2::jsonb, $3),
       ($4, 'movie', 'ai_analysis', 'awaiting_decision', $5::jsonb, $3),
       ($6, 'movie', 'queued_for_retry', 'pending_retry', $7::jsonb, $3)`,
    [
      'Synthetic route policy-auto fixture',
      JSON.stringify(buildFixtureMetadata({
        mode: 'skip',
        invoked: false,
        reasonCode: 'policy_auto',
      })),
      createdAt,
      'Synthetic route verification-required fixture',
      JSON.stringify(buildFixtureMetadata({
        mode: 'verify',
        invoked: true,
        reasonCode: 'unique_review_candidate',
        verificationStatusId: 'abstained',
      })),
      'Synthetic route AI-unavailable retry fixture',
      JSON.stringify({
        fixture_tag: FIXTURE_TAG,
        fixture_private_value: PRIVATE_FIXTURE_VALUE,
      }),
    ],
  );
}

describe('classification decision-path telemetry live-stats route integration', () => {
  let pool;

  beforeAll(() => {
    pool = getPool();
  });

  test('denies an unauthenticated request and returns only aggregate telemetry to an authenticated request', async () => {
    const observationEnd = new Date();
    const fixtureCreatedAt = new Date(observationEnd.getTime() - 1_000);
    let publicResponse;
    let queueService;
    let authentication;
    const requireReadWrite = jest.fn(() => {
      throw new Error('Read-only live-stats requests must not require write authorization.');
    });

    await withRollbackTransaction(pool, async (client) => {
      const baselineService = createClassificationDecisionPathTelemetryService({
        database: client,
        now: () => observationEnd,
      });
      const baselineTelemetry = await baselineService.getTelemetry({
        queueStats: { pending: 1 },
      });

      await seedTelemetryFixture(client, fixtureCreatedAt);

      const telemetryService = createClassificationDecisionPathTelemetryService({
        database: client,
        now: () => observationEnd,
      });
      const queueReadModel = new QueueReadModel({
        db: client,
        logger: createLogger(),
        getClassificationAdmissionDiagnostics: async () => null,
        getClassificationDecisionPathTelemetry: (input) => telemetryService.getTelemetry(input),
      });
      queueService = createTransactionScopedQueueServiceAdapter(queueReadModel);
      authentication = createAuthenticationMiddleware();
      const app = createIntegrationTestApp({
        basePath: '/api/queue',
        router: createQueueRouter({
          express,
          queueService,
          logger: createLogger(),
          authenticateTokenOrApiKey: authentication,
          requireReadWrite,
        }),
      });

      await request(app)
        .get('/api/queue/live-stats')
        .expect(401)
        .expect({ error: 'Authentication required' });
      expect(queueService.getLiveStats).not.toHaveBeenCalled();

      const response = await request(app)
        .get('/api/queue/live-stats')
        .set('Authorization', TEST_AUTHORIZATION)
        .expect('content-type', /json/)
        .expect(200);

      publicResponse = response.body;
      const telemetry = response.body.queue.classificationDecisionPathTelemetry;

      expect(authentication).toHaveBeenCalledTimes(2);
      expect(requireReadWrite).not.toHaveBeenCalled();
      expect(queueService.getLiveStats).toHaveBeenCalledTimes(1);
      expect(telemetry).toEqual(expect.objectContaining({
        version: 'classification.decision_path_telemetry.v1',
        window: { hours: 24 },
      }));
      expect(subtractCounts(telemetry.counts, baselineTelemetry.counts)).toEqual({
        deterministicPolicy: 1,
        aiClassificationAttempt: 1,
        aiUnavailableRetry: 1,
        strictVerificationAbstention: 1,
      });
    });

    const fixtureRows = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM classification_history
       WHERE metadata ->> 'fixture_tag' = $1`,
      [FIXTURE_TAG],
    );
    const serializedResponse = JSON.stringify(publicResponse);

    expect(fixtureRows.rows[0].count).toBe(0);
    expect(Object.keys(publicResponse.queue.classificationDecisionPathTelemetry)).toEqual([
      'version',
      'window',
      'counts',
    ]);
    expect(serializedResponse).not.toContain(FIXTURE_TAG);
    expect(serializedResponse).not.toContain(PRIVATE_FIXTURE_VALUE);
    expect(serializedResponse).not.toContain('Synthetic route policy-auto fixture');
    expect(serializedResponse).not.toContain('Synthetic route verification-required fixture');
  });
});
