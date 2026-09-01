/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
} from '../../services/aiProviderCapabilityMetricsFailureCategories.mjs';
import {
  createAiProviderCapabilityMetricsFailureBreakdownService,
} from '../../services/aiProviderCapabilityMetricsFailureBreakdownService.mjs';
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

describe('AI provider capability metrics safe failure breakdown', () => {
  test('aggregates fixed category metadata and leaves older warnings uncategorized', async () => {
    const database = getPool();
    const now = new Date('2026-09-01T12:00:00.000Z');
    const observedAt = new Date('2026-09-01T11:59:00.000Z');

    await database.query(`
      INSERT INTO error_log (level, module, message, metadata, created_at)
      VALUES
        ('WARN', $1, $2, $3::jsonb, $4),
        ('WARN', $1, $2, $5::jsonb, $4),
        ('WARN', $1, $2, $6::jsonb, $4)
    `, [
      AI_PROVIDER_CAPABILITY_METRICS_LOG_MODULE,
      AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_MESSAGE,
      JSON.stringify({
        reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
        capabilityMetricsFailureStage: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
        capabilityMetricsSqlstateCategory: 'connection_exception',
      }),
      observedAt.toISOString(),
      JSON.stringify({
        reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
        capabilityMetricsFailureStage: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
        capabilityMetricsSqlstateCategory: 'not_available',
      }),
      JSON.stringify({
        reasonCode: AI_PROVIDER_CAPABILITY_METRICS_WRITE_FAILURE_REASON_CODE,
        provider: 'private-provider',
        error: 'postgres://private-endpoint',
      }),
    ]);

    const service = createAiProviderCapabilityMetricsFailureBreakdownService({
      database,
      now: () => now,
    });
    const report = await service.getReport();

    expect(report).toMatchObject({
      totalFailureCount: '3',
      safeCategoryFailureCount: '2',
      uncategorizedFailureCount: '1',
      status: { id: 'partial' },
    });
    expect(report.sqlstateCategories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'connection_exception', count: '1' }),
      expect.objectContaining({ id: 'not_available', count: '1' }),
    ]));
    expect(JSON.stringify(report)).not.toContain('private-provider');
    expect(JSON.stringify(report)).not.toContain('private-endpoint');
  });
});
