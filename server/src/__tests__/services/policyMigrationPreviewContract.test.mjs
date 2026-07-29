/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import {
  POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS,
  POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS,
  POLICY_MIGRATION_PREVIEW_STATUS_IDS,
  buildPolicyMigrationPreview,
  buildPolicyMigrationPreviewContract,
  validatePolicyMigrationPreview,
  validatePolicyMigrationPreviewContract,
} from '../../services/policyMigrationPreviewContract.mjs';

describe('policyMigrationPreviewContract', () => {
  test('defines a server-owned, comparison-only contract', () => {
    const contract = buildPolicyMigrationPreviewContract();

    expect(contract).toEqual(expect.objectContaining({
      serverOwned: true,
      normalWorkflowSurface: false,
      representativeClassificationsRequired: true,
      minimumRepresentativeClassifications: 1,
      sideEffectsAllowed: false,
    }));
    expect(validatePolicyMigrationPreviewContract(contract).ok).toBe(true);
  });

  test('reports no differences only after comparing a representative classification', () => {
    const preview = buildPolicyMigrationPreview({
      representativeClassifications: [{
        classificationId: 10674,
        title: 'Mulan',
        legacyOutcome: {
          destinationLibraryId: 6,
          routeReady: true,
          confidenceScore: 0.8,
          confidenceLevel: 'high',
        },
        generatedIntentOutcome: {
          destinationLibraryId: 6,
          routeReady: true,
          confidenceScore: 0.8,
          confidenceLevel: 'high',
        },
      }],
    });

    expect(preview.statusId).toBe(POLICY_MIGRATION_PREVIEW_STATUS_IDS.NO_MIGRATION_DIFFERENCES);
    expect(preview.representativeSummary).toEqual(expect.objectContaining({
      comparedCount: 1,
      coverageSufficient: true,
      rawPayloadSuppressed: false,
    }));
    expect(preview.differenceSummary.totalCount).toBe(0);
    expect(validatePolicyMigrationPreview(preview).ok).toBe(true);
  });

  test('blocks an empty comparison from claiming parity', () => {
    const preview = buildPolicyMigrationPreview();

    expect(preview.statusId)
      .toBe(POLICY_MIGRATION_PREVIEW_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE);
    expect(preview.representativeSummary).toEqual(expect.objectContaining({
      comparedCount: 0,
      coverageSufficient: false,
    }));
    expect(validatePolicyMigrationPreview(preview).ok).toBe(true);
  });

  test('does not count an unusable classification as representative coverage', () => {
    const preview = buildPolicyMigrationPreview({
      representativeClassifications: [{
        classificationId: 10674,
      }],
    });

    expect(preview.statusId)
      .toBe(POLICY_MIGRATION_PREVIEW_STATUS_IDS.INSUFFICIENT_REPRESENTATIVE_COVERAGE);
    expect(preview.representativeSummary).toEqual(expect.objectContaining({
      receivedCount: 1,
      comparedCount: 0,
      unusableCount: 1,
      coverageSufficient: false,
    }));
    expect(validatePolicyMigrationPreview(preview).ok).toBe(true);
  });

  test('does not manufacture a confidence-label difference when persisted history has no label', () => {
    const preview = buildPolicyMigrationPreview({
      representativeClassifications: [{
        itemId: 10674,
        legacyOutcome: {
          destinationLibraryId: 6,
          routeReady: true,
          confidenceScore: 0.8,
        },
        generatedIntentOutcome: {
          destinationLibraryId: 6,
          routeReady: true,
          confidenceScore: 0.8,
          confidenceLevel: 'high',
        },
      }],
    });

    expect(preview.statusId).toBe(POLICY_MIGRATION_PREVIEW_STATUS_IDS.NO_MIGRATION_DIFFERENCES);
    expect(preview.differenceSummary.totalCount).toBe(0);
    expect(validatePolicyMigrationPreview(preview).ok).toBe(true);
  });

  test('emits bounded, sanitized migration differences from legacy aliases', () => {
    const preview = buildPolicyMigrationPreview({
      maxDifferences: 1,
      confidenceDeltaThreshold: 0.1,
      representativeClassifications: [{
        itemId: 7,
        title: 'Different destination',
        legacy: {
          destinationLibraryId: 7,
          routeReady: true,
          confidenceScore: 0.9,
          confidenceLevel: 'high',
        },
        proposed: {
          destinationLibraryId: 6,
          routeReady: false,
          needsReview: true,
          confidenceScore: 0.5,
          confidenceLevel: 'medium',
        },
        rawPayload: { provider: 'suppressed' },
      }],
    });

    expect(preview.statusId).toBe(POLICY_MIGRATION_PREVIEW_STATUS_IDS.REVIEW_REQUIRED);
    expect(preview.differenceSummary).toEqual(expect.objectContaining({
      totalCount: 4,
      emittedCount: 1,
      truncated: true,
      byType: expect.objectContaining({
        [POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE]: 1,
        [POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.NEWLY_REVIEW_REQUIRED_ITEM]: 1,
        [POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.ROUTE_READINESS_CHANGE]: 1,
        [POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.EVIDENCE_CONFIDENCE_CHANGE]: 1,
      }),
    }));
    expect(preview.representativeSummary.rawPayloadSuppressed).toBe(true);
    expect(JSON.stringify(preview)).not.toContain('"provider":"suppressed"');
    expect(preview.differences).toEqual([expect.objectContaining({
      exposesRawPayload: false,
      generatedIntentValue: 6,
    })]);
    expect(validatePolicyMigrationPreview(preview).ok).toBe(true);
  });

  test('rejects a preview that exposes raw input or mismatches coverage state', () => {
    const preview = buildPolicyMigrationPreview();
    preview.statusId = POLICY_MIGRATION_PREVIEW_STATUS_IDS.NO_MIGRATION_DIFFERENCES;
    preview.differences = [{
      typeId: POLICY_MIGRATION_PREVIEW_DIFFERENCE_TYPE_IDS.DESTINATION_CHANGE,
      rawPayload: { leaked: true },
    }];
    preview.differenceSummary.emittedCount = 1;

    expect(validatePolicyMigrationPreview(preview).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.RAW_PAYLOAD_EXPOSED,
      }),
      expect.objectContaining({
        riskId: POLICY_MIGRATION_PREVIEW_AUDIT_RISK_IDS.INSUFFICIENT_COVERAGE_STATUS_MISMATCH,
      }),
    ]));
  });
});
