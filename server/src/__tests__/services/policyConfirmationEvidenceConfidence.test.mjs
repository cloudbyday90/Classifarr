/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  buildPolicyConfirmationEvidenceConfidenceInterval,
} from '../../services/policyConfirmationEvidenceConfidence.mjs';

describe('policyConfirmationEvidenceConfidence', () => {
  test('returns a fixed 95% Wilson interval for an aggregate rate', () => {
    expect(buildPolicyConfirmationEvidenceConfidenceInterval({
      successCount: 11,
      observationCount: 20,
    })).toEqual({
      methodId: 'wilson_score',
      confidenceLevelPercent: 95,
      lowerRatePercent: 34.2,
      upperRatePercent: 74.2,
    });
  });

  test('bounds malformed counts and remains unavailable without observations', () => {
    expect(buildPolicyConfirmationEvidenceConfidenceInterval({
      successCount: 999,
      observationCount: 20,
    })).toMatchObject({ lowerRatePercent: 83.9, upperRatePercent: 100 });
    expect(buildPolicyConfirmationEvidenceConfidenceInterval({
      successCount: -1,
      observationCount: 'not-a-count',
    })).toBeNull();
  });
});
