/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
} from '../../services/aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  createAiProviderCapabilityMetricsFailureCategoryCoverageService,
} from '../../services/aiProviderCapabilityMetricsFailureCategoryCoverageService.mjs';
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

describe('AI provider capability metrics safe category coverage', () => {
  test('compares fixed metadata adoption across completed UTC days without returning diagnostics', async () => {
    const database = getPool();
    const now = new Date('2026-09-01T12:00:00.000Z');
    const metadata = (category) => JSON.stringify({
      reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
      ...(category ? {
        capabilityMetricsFailureStage: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
        capabilityMetricsSqlstateCategory: category,
      } : {
        provider: 'private-provider',
        error: 'postgres://private-endpoint',
      }),
    });

    await database.query(`
      INSERT INTO error_log (level, module, message, metadata, created_at)
      VALUES
        ('WARN', $1, $2, $3::jsonb, '2026-08-29T12:00:00.000Z'),
        ('WARN', $1, $2, $4::jsonb, '2026-08-30T12:00:00.000Z'),
        ('WARN', $1, $2, $5::jsonb, '2026-08-31T12:00:00.000Z'),
        ('WARN', $1, $2, $6::jsonb, '2026-08-31T13:00:00.000Z')
    `, [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      metadata(null),
      metadata('not_available'),
      metadata('connection_exception'),
      metadata(null),
    ]);

    const service = createAiProviderCapabilityMetricsFailureCategoryCoverageService({
      database,
      now: () => now,
    });
    const report = await service.getReport();

    expect(report).toMatchObject({
      periods: [
        { id: 'baseline', totalFailureCount: '1', safeCategoryFailureCount: '0', safeCategoryCoveragePercent: '0' },
        { id: 'previous', totalFailureCount: '1', safeCategoryFailureCount: '1', safeCategoryCoveragePercent: '100' },
        { id: 'current', totalFailureCount: '2', safeCategoryFailureCount: '1', safeCategoryCoveragePercent: '50' },
      ],
      status: { id: 'partial' },
    });
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });
});
