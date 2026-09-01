/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../../services/aiProviderCapabilityMetricsLogging.mjs';
import {
  createAiProviderCapabilityMetricsHealthTrendService,
} from '../../services/aiProviderCapabilityMetricsHealthTrendService.mjs';
import { getPool } from './setup.mjs';

const providerId = 'test-capability-health-trend';
const model = 'capability-health-trend-regression';
const authorityMode = 'proposal';

afterEach(async () => {
  const database = getPool();
  await database.query(
    'DELETE FROM ai_provider_capability_metrics WHERE provider_id = $1 AND model = $2 AND authority_mode = $3',
    [providerId, model, authorityMode],
  );
  await database.query(
    "DELETE FROM error_log WHERE module = $1 AND metadata->>'reasonCode' = $2",
    [AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE, AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE],
  );
});

describe('AI provider capability metrics completed-window health trend', () => {
  test('reports a persistent aggregate warning pattern without exposing source records', async () => {
    const database = getPool();
    const now = new Date('2026-09-01T12:00:00.000Z');
    const previousObservedAt = new Date('2026-08-30T12:00:00.000Z');
    const currentObservedAt = new Date('2026-08-31T12:00:00.000Z');

    await database.query(`
      INSERT INTO ai_provider_capability_metrics (
        provider_id, model, authority_mode, request_count, last_observed_at
      ) VALUES ($1, $2, $3, 1, $4)
    `, [providerId, model, authorityMode, currentObservedAt.toISOString()]);
    await database.query(`
      INSERT INTO error_log (level, module, message, metadata, created_at)
      VALUES
        ('WARN', $1, $2, $3::jsonb, $4),
        ('WARN', $1, $2, $3::jsonb, $5)
    `, [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      JSON.stringify({ reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE }),
      previousObservedAt.toISOString(),
      currentObservedAt.toISOString(),
    ]);

    const service = createAiProviderCapabilityMetricsHealthTrendService({
      database,
      now: () => now,
    });

    const report = await service.getReport();
    expect(report).toMatchObject({
      status: { id: 'persistent_persistence_failures' },
      periods: expect.arrayContaining([
        expect.objectContaining({ id: 'previous', persistenceFailureCount: '1' }),
        expect.objectContaining({ id: 'current', persistenceFailureCount: '1' }),
      ]),
    });
    expect(JSON.stringify(report)).not.toContain(providerId);
    expect(JSON.stringify(report)).not.toContain(model);
    expect(JSON.stringify(report)).not.toContain(AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE);
  });
});
