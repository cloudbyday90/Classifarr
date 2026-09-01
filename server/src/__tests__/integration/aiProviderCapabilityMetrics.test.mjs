/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { afterEach, describe, expect, test } from '@jest/globals';

import { incrementAiProviderCapabilityMetrics } from '../../services/aiProviderCapabilityMetricsRepository.mjs';
import { getPool } from './setup.mjs';

const metricRows = [];

function buildDelta({ modelDigestMismatchCount = 0 } = {}) {
  const providerId = `test-metrics-${Date.now()}`;
  const model = 'capability-metrics-regression';
  const authorityMode = 'proposal';

  metricRows.push({ providerId, model, authorityMode });

  return {
    providerId,
    model,
    authorityMode,
    requestCount: 1,
    structuredParseSuccessCount: 0,
    semanticContractViolationCount: 0,
    repairAttemptCount: 0,
    repairSuccessCount: 0,
    timeoutOrIncompleteStreamCount: 0,
    modelDigestMismatchCount,
    hallucinatedLibraryReferenceCount: 0,
    hallucinatedActionCount: 0,
    thinkingTraceLeakageCount: 0,
  };
}

afterEach(async () => {
  const db = getPool();
  await Promise.all(metricRows.splice(0).map(({ providerId, model, authorityMode }) => (
    db.query(
      `DELETE FROM ai_provider_capability_metrics
       WHERE provider_id = $1 AND model = $2 AND authority_mode = $3`,
      [providerId, model, authorityMode],
    )
  )));
});

describe('AI provider capability metrics persistence', () => {
  test('records a model-digest mismatch without ambiguous PostgreSQL parameter types', async () => {
    const db = getPool();
    const delta = buildDelta({ modelDigestMismatchCount: 1 });

    await incrementAiProviderCapabilityMetrics(db, delta);
    await incrementAiProviderCapabilityMetrics(db, {
      ...delta,
      modelDigestMismatchCount: 0,
    });

    const result = await db.query(
      `SELECT
         request_count::text AS request_count,
         model_digest_mismatch_count::text AS model_digest_mismatch_count,
         last_model_digest_mismatch_at IS NOT NULL AS has_mismatch_timestamp
       FROM ai_provider_capability_metrics
       WHERE provider_id = $1 AND model = $2 AND authority_mode = $3`,
      [delta.providerId, delta.model, delta.authorityMode],
    );

    expect(result.rows).toEqual([{
      request_count: '2',
      model_digest_mismatch_count: '1',
      has_mismatch_timestamp: true,
    }]);
  });
});
