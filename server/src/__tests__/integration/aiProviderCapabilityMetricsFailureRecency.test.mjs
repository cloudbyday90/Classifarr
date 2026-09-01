/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import {
  createAiProviderCapabilityMetricsFailureRecencyService,
} from '../../services/aiProviderCapabilityMetricsFailureRecencyService.mjs';
import {
  AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
  AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
} from '../../services/aiProviderCapabilityMetricsLogging.mjs';
import { getPool } from './setup.mjs';

afterEach(async () => {
  await getPool().query(
    "DELETE FROM error_log WHERE module = $1 AND metadata->>'reasonCode' = $2",
    [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
    ],
  );
});

describe('AI provider capability metrics warning recency', () => {
  test('uses only completed aggregate counts to distinguish a newly cleared warning', async () => {
    const database = getPool();
    const now = new Date('2026-09-01T12:00:00.000Z');
    const metadata = JSON.stringify({
      reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
      provider: 'private-provider',
      error: 'postgres://private-endpoint',
    });

    await database.query(`
      INSERT INTO error_log (level, module, message, metadata, created_at)
      VALUES
        ('WARN', $1, $2, $3::jsonb, '2026-08-30T12:00:00.000Z'),
        ('WARN', $1, $2, $3::jsonb, '2026-08-30T13:00:00.000Z')
    `, [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      metadata,
    ]);

    const service = createAiProviderCapabilityMetricsFailureRecencyService({
      database,
      now: () => now,
    });
    const report = await service.getReport();

    expect(report).toMatchObject({
      periods: [
        { id: 'baseline', persistenceFailureCount: '0' },
        { id: 'previous', persistenceFailureCount: '2' },
        { id: 'current', persistenceFailureCount: '0' },
      ],
      recency: { id: 'cleared_for_one_completed_day', completedDaysSinceLastWarning: 1 },
      status: { id: 'cleared_for_one_completed_day' },
    });
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });
});
