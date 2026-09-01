/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
  buildAiProviderCapabilityMetricsFailureMetadata,
  resolveAiProviderCapabilityMetricsSqlstateCategory,
} from '../services/aiProviderCapabilityMetricsFailureCategories.mjs';

describe('aiProviderCapabilityMetricsFailureCategories', () => {
  test.each([
    ['08006', 'connection_exception'],
    ['40P01', 'transaction_rollback'],
    ['53100', 'insufficient_resources'],
    ['57P01', 'operator_intervention'],
    ['XX000', 'system_error'],
    ['22012', 'other_database_condition'],
    ['ECONNREFUSED', 'not_available'],
    [undefined, 'not_available'],
  ])('maps %p to a fixed SQLSTATE category', (code, expected) => {
    expect(resolveAiProviderCapabilityMetricsSqlstateCategory({ code })).toBe(expected);
  });

  test('retains only fixed metadata and excludes raw database diagnostics', () => {
    const metadata = buildAiProviderCapabilityMetricsFailureMetadata(Object.assign(
      new Error('postgres://operator:secret@private-db must not persist'),
      { code: '08006' },
    ));

    expect(metadata).toEqual({
      reasonCode: 'ai_provider_capability_metrics_persistence_failed',
      capabilityMetricsFailureStage: AI_PROVIDER_CAPABILITY_METRICS_FAILURE_STAGE,
      capabilityMetricsSqlstateCategory: 'connection_exception',
    });
    expect(JSON.stringify(metadata)).not.toContain('private-db');
    expect(JSON.stringify(metadata)).not.toContain('secret');
    expect(JSON.stringify(metadata)).not.toContain('08006');
  });
});
