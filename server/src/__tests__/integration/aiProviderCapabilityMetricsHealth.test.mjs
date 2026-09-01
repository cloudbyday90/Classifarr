/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../../services/aiProviderCapabilityMetricsHealthRepository.mjs';
import {
  createAiProviderCapabilityMetricsHealthService,
} from '../../services/aiProviderCapabilityMetricsHealthService.mjs';
import { getPool } from './setup.mjs';

const providerId = 'test-capability-health';
const model = 'capability-health-regression';
const authorityMode = 'proposal';

afterEach(async () => {
  const database = getPool();
  await database.query(
    'DELETE FROM ai_provider_capability_metrics WHERE provider_id = $1 AND model = $2 AND authority_mode = $3',
    [providerId, model, authorityMode],
  );
});

describe('AI provider capability metrics health persistence', () => {
  test('aggregates a persisted stream and write warning without exposing either source record', async () => {
    const database = getPool();
    const now = new Date('2026-08-31T13:00:00.000Z');
    const observedAt = new Date('2026-08-31T12:59:00.000Z');

    await database.query(`
      INSERT INTO ai_provider_capability_metrics (
        provider_id, model, authority_mode, request_count, last_observed_at
      ) VALUES ($1, $2, $3, 1, $4)
    `, [providerId, model, authorityMode, observedAt.toISOString()]);
    await database.query(`
      INSERT INTO error_log (level, module, message, metadata, created_at)
      VALUES ('WARN', $1, $2, $3::jsonb, $4)
    `, [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      JSON.stringify({ reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE }),
      observedAt.toISOString(),
    ]);

    const service = createAiProviderCapabilityMetricsHealthService({
      database,
      now: () => now,
    });

    await expect(service.getReport()).resolves.toMatchObject({
      activeMetricStreamCount: '1',
      persistenceFailureCount: '1',
      status: { id: 'persistence_failures_detected' },
    });
  });
});
