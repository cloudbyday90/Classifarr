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
  POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS,
  POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS,
  POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS,
  buildPolicyManualCorrectionLearning,
  buildPolicyManualCorrectionLearningAudit,
} from '../../services/policyManualCorrectionLearning.mjs';

describe('policyManualCorrectionLearning', () => {
  const validInput = {
    classification: {
      id: 42,
      tmdbId: 10674,
      mediaType: 'movie',
    },
    destination: {
      libraryId: 8,
      libraryName: 'Animated Movies',
    },
    finalOutcomeRecorded: true,
  };

  it('admits an authoritative correction as exact-item memory only', () => {
    const result = buildPolicyManualCorrectionLearning(validInput);

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.READY,
      exactItemMemory: {
        eligible: true,
        classificationId: 42,
        tmdbId: 10674,
        mediaType: 'movie',
        libraryId: 8,
      },
      decision: {
        finalOutcome: {
          recorded: true,
          itemId: 42,
          destinationLibraryId: 8,
        },
        learning: {
          decisionId: 'candidate',
          tierId: 'exact_item_memory',
          canWriteLearning: true,
          writesPerformed: false,
        },
        profileRefresh: {
          queue: false,
        },
      },
      sideEffects: {
        learningMutationPerformed: false,
        profileRefreshQueued: false,
        providerLookupPerformed: false,
        providerQuotaRead: false,
        routeAttemptPerformed: false,
      },
      audit: {
        ok: true,
      },
    });
    expect(result.exactItemMemory.reasonCodes).toContain(
      POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.EXACT_ITEM_MEMORY_ADMITTED
    );
  });

  it('records outcome only when the correction cannot identify one exact item', () => {
    const result = buildPolicyManualCorrectionLearning({
      ...validInput,
      classification: {
        ...validInput.classification,
        tmdbId: null,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.OUTCOME_ONLY,
      exactItemMemory: {
        eligible: false,
      },
      decision: {
        learning: {
          decisionId: 'outcome_only',
          tierId: 'none',
          canWriteLearning: false,
        },
      },
      audit: {
        ok: true,
      },
    });
    expect(result.exactItemMemory.reasonCodes).toContain(
      POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.EXACT_ITEM_REFERENCE_MISSING
    );
  });

  it('blocks learning when final outcome persistence was not confirmed', () => {
    const result = buildPolicyManualCorrectionLearning({
      ...validInput,
      finalOutcomeRecorded: false,
    });

    expect(result).toMatchObject({
      ok: false,
      statusId: POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.BLOCKED,
      exactItemMemory: {
        eligible: false,
      },
      decision: {
        finalOutcome: {
          recorded: false,
        },
        learning: {
          decisionId: 'outcome_only',
          canWriteLearning: false,
        },
      },
      audit: {
        ok: true,
      },
    });
    expect(result.exactItemMemory.reasonCodes).toContain(
      POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.FINAL_OUTCOME_NOT_RECORDED
    );
  });

  it('refuses unsupported media types as durable exact-item memory', () => {
    const result = buildPolicyManualCorrectionLearning({
      ...validInput,
      classification: {
        ...validInput.classification,
        mediaType: 'audiobook',
      },
    });

    expect(result).toMatchObject({
      statusId: POLICY_MANUAL_CORRECTION_LEARNING_STATUS_IDS.OUTCOME_ONLY,
      exactItemMemory: {
        eligible: false,
        mediaType: null,
      },
      audit: {
        ok: true,
      },
    });
    expect(result.exactItemMemory.reasonCodes).toContain(
      POLICY_MANUAL_CORRECTION_LEARNING_REASON_IDS.UNSUPPORTED_MEDIA_TYPE
    );
  });

  it('detects tampered outcomes that claim a profile refresh', () => {
    const result = buildPolicyManualCorrectionLearning(validInput);
    const audit = buildPolicyManualCorrectionLearningAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        profileRefreshQueued: true,
      },
    });

    expect(audit).toMatchObject({
      ok: false,
      issueCount: 1,
    });
    expect(audit.issues[0].riskId).toBe(
      POLICY_MANUAL_CORRECTION_LEARNING_AUDIT_RISK_IDS.PROFILE_REFRESH_QUEUED
    );
  });
});
