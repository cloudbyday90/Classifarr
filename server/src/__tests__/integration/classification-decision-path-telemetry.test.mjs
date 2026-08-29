/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { beforeAll, describe, expect, jest, test } from '@jest/globals';

import { createIntegrationDatabaseModuleMock, getPool } from './setup.mjs';

jest.unstable_mockModule('../../config/database.mjs', () => createIntegrationDatabaseModuleMock());

const { QueueReadModel } = await import('../../services/queueReadModel.mjs');
const {
  CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
} = await import('../../services/classificationDeterministicAiMode.mjs');
const {
  CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
} = await import('../../services/classificationCandidateBoundVerificationContract.mjs');
const {
  createClassificationDecisionPathTelemetryService,
} = await import('../../services/classificationDecisionPathTelemetryService.mjs');

const FIXTURE_TAG = 'classification-decision-path-telemetry-transaction-fixture';
const PRIVATE_FIXTURE_VALUE = 'synthetic-private-fixture-value';

function createLogger() {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

function buildFixtureMetadata({ mode, invoked, reasonCode, verificationStatusId = null }) {
  const classificationDetails = {
    deterministic_ai_mode: {
      version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
      mode,
      invoked,
      reason_code: reasonCode,
      policy_action: invoked ? 'prompt_confirm' : 'auto_classify',
      candidate_count: invoked ? 1 : 0,
    },
  };

  if (verificationStatusId) {
    classificationDetails.candidate_bound_verification = {
      version: CLASSIFICATION_CANDIDATE_BOUND_VERIFICATION_VERSION,
      status_id: verificationStatusId,
    };
  }

  return {
    classification_details: classificationDetails,
    fixture_tag: FIXTURE_TAG,
    fixture_private_value: PRIVATE_FIXTURE_VALUE,
  };
}

function subtractCounts(after, before) {
  return Object.fromEntries(Object.keys(after).map((key) => [
    key,
    after[key] - before[key],
  ]));
}

async function withRollbackTransaction(pool, operation) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    return await operation(client);
  } finally {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    client.release();
  }
}

describe('classification decision-path telemetry integration', () => {
  let pool;

  beforeAll(() => {
    pool = getPool();
  });

  test('projects only aggregate deltas for synthetic policy and verification decisions', async () => {
    const observationEnd = new Date();
    const fixtureCreatedAt = new Date(observationEnd.getTime() - 1_000);
    let publicTelemetry;

    await withRollbackTransaction(pool, async (client) => {
      const baselineService = createClassificationDecisionPathTelemetryService({
        database: client,
        now: () => observationEnd,
      });
      const baselineTelemetry = await baselineService.getTelemetry({
        queueStats: { pending: 1 },
      });
      expect(baselineTelemetry).not.toBeNull();

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
          'Synthetic policy-auto telemetry fixture',
          JSON.stringify(buildFixtureMetadata({
            mode: 'skip',
            invoked: false,
            reasonCode: 'policy_auto',
          })),
          fixtureCreatedAt,
          'Synthetic verification-required telemetry fixture',
          JSON.stringify(buildFixtureMetadata({
            mode: 'verify',
            invoked: true,
            reasonCode: 'unique_review_candidate',
            verificationStatusId: 'abstained',
          })),
          'Synthetic AI-unavailable retry telemetry fixture',
          JSON.stringify({
            fixture_tag: FIXTURE_TAG,
            fixture_private_value: PRIVATE_FIXTURE_VALUE,
          }),
        ],
      );

      const telemetryService = createClassificationDecisionPathTelemetryService({
        database: client,
        now: () => observationEnd,
      });
      const readModel = new QueueReadModel({
        db: client,
        logger: createLogger(),
        getClassificationAdmissionDiagnostics: async () => null,
        getClassificationDecisionPathTelemetry: (input) => telemetryService.getTelemetry(input),
      });
      const stats = await readModel.getStats();

      publicTelemetry = stats.classificationDecisionPathTelemetry;
      expect(stats.pending).toBe(1);
      expect(publicTelemetry).toEqual(expect.objectContaining({
        version: 'classification.decision_path_telemetry.v1',
        window: { hours: 24 },
      }));
      expect(subtractCounts(publicTelemetry.counts, baselineTelemetry.counts)).toEqual({
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
    const serializedTelemetry = JSON.stringify(publicTelemetry);

    expect(fixtureRows.rows[0].count).toBe(0);
    expect(Object.keys(publicTelemetry)).toEqual(['version', 'window', 'counts']);
    expect(Object.keys(publicTelemetry.counts)).toEqual([
      'deterministicPolicy',
      'aiClassificationAttempt',
      'aiUnavailableRetry',
      'strictVerificationAbstention',
    ]);
    expect(serializedTelemetry).not.toContain(FIXTURE_TAG);
    expect(serializedTelemetry).not.toContain(PRIVATE_FIXTURE_VALUE);
    expect(serializedTelemetry).not.toContain('Synthetic policy-auto telemetry fixture');
    expect(serializedTelemetry).not.toContain('Synthetic verification-required telemetry fixture');
  });
});
