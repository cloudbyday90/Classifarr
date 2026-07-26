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
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS,
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS,
  POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS,
  buildNativePendingResolutionOutcomePatch,
  buildPolicyNativePendingResolutionProvenance,
  buildPolicyNativePendingResolutionProvenanceAudit,
} from '../../services/policyNativePendingResolutionProvenance.mjs';
import {
  buildPolicyRuntimeQuestionReductionFromRuntimeInput,
} from '../../services/policyRuntimeQuestionReduction.mjs';

function buildNativeQuestion(overrides = {}) {
  const plan = buildPolicyRuntimeQuestionReductionFromRuntimeInput({
    libraryProfile: {
      identityCandidates: [
        { label: 'Animation', count: 1, confidence: 0.6 },
      ],
    },
    metadataSignals: [
      { label: 'Family', confidence: 0.7 },
    ],
  });

  expect(plan.question).toBeTruthy();

  return {
    version: 'policy.runtime_question_persistence.v1',
    question: plan.question.operatorQuestion,
    options: [
      {
        label: 'Resolve current item',
        outcomeId: 'resolve_current_item',
        library_id: 6,
      },
      {
        label: 'Do not learn',
        outcomeId: 'do_not_learn',
      },
    ],
    runtimeQuestion: plan.question,
    runtimeQuestionReductionPlan: plan,
    meta: {
      runtime_question_persistence: {
        destinationLibraryId: 6,
        destinationLibraryName: 'Animated Movies',
      },
    },
    ...overrides,
  };
}

function buildInput(overrides = {}) {
  return {
    classification: { id: 42, title: 'Do not persist this title' },
    persistedQuestion: buildNativeQuestion(),
    selectedDestination: {
      libraryId: 6,
      libraryName: 'Animated Movies',
    },
    selectedOption: 'Resolve current item',
    ...overrides,
  };
}

describe('policyNativePendingResolutionProvenance', () => {
  test('records a server-validated confirmation separately from its future routing result', () => {
    const result = buildPolicyNativePendingResolutionProvenance(buildInput());

    expect(result).toMatchObject({
      ok: true,
      statusId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.OUTCOME_ONLY,
      selection: {
        eventTypeId: 'operator_confirmed_destination',
        selectedOutcomeId: 'resolve_current_item',
        suggestedDestination: {
          libraryId: 6,
          libraryName: 'Animated Movies',
        },
        selectedDestination: {
          libraryId: 6,
          libraryName: 'Animated Movies',
        },
        alternateDestination: false,
      },
      requestTimeDecision: {
        validationOk: true,
        eventTypeId: 'operator_confirmed_destination',
        sourceId: 'operator_confirmation',
        dispositionId: 'outcome_only',
      },
      learningIntake: {
        version: 'policy.learning_intake.v1',
        sourceId: 'operator_confirmation',
        sourceEventId: 'classification:42',
        answerOutcomeId: 'resolve_current_item',
      },
      learningGuard: {
        decisionId: 'outcome_only',
        tierId: 'none',
        canWriteLearning: false,
        profileRefreshQueued: false,
      },
      sideEffects: {
        outcomePersisted: false,
        learningWritten: false,
        routingAttempted: false,
      },
      audit: { ok: true },
    });
    expect(JSON.stringify(result)).not.toContain('Do not persist this title');
  });

  test('retains the do-not-learn outcome as an explicit normalized selection', () => {
    const result = buildPolicyNativePendingResolutionProvenance(buildInput({
      selectedOption: 'Do not learn',
    }));

    expect(result.selection).toEqual(expect.objectContaining({
      eventTypeId: 'operator_confirmed_destination',
      selectedOutcomeId: 'do_not_learn',
      alternateDestination: false,
    }));
    expect(result.learningGuard).toEqual(expect.objectContaining({
      canWriteLearning: false,
      profileRefreshQueued: false,
    }));
    expect(result.audit.ok).toBe(true);
  });

  test('records an alternate compatible destination as a reversible manual change', () => {
    const result = buildPolicyNativePendingResolutionProvenance(buildInput({
      selectedDestination: {
        libraryId: 9,
        libraryName: 'Movies',
      },
      selectedOption: 'Choose another destination',
    }));

    expect(result.selection).toEqual(expect.objectContaining({
      eventTypeId: 'operator_manual_destination_change',
      selectedOutcomeId: 'do_not_learn',
      alternateDestination: true,
      suggestedDestination: expect.objectContaining({ libraryId: 6 }),
      selectedDestination: expect.objectContaining({ libraryId: 9 }),
    }));
    expect(result.requestTimeDecision).toEqual(expect.objectContaining({
      sourceId: 'manual_classification_change',
      validationOk: true,
    }));
    expect(result.learningGuard.canWriteLearning).toBe(false);
    expect(result.audit.ok).toBe(true);
  });

  test('keeps a fingerprint-drifted persisted plan outcome-only without manufacturing a request-time decision', () => {
    const persistedQuestion = buildNativeQuestion();
    persistedQuestion.runtimeQuestionReductionPlan = {
      ...persistedQuestion.runtimeQuestionReductionPlan,
      trace: {
        ...persistedQuestion.runtimeQuestionReductionPlan.trace,
        attributes: {
          ...persistedQuestion.runtimeQuestionReductionPlan.trace.attributes,
          'classifarr.runtime.question.decision_evidence_projection_fingerprint': 'tampered',
        },
      },
    };

    const result = buildPolicyNativePendingResolutionProvenance(buildInput({ persistedQuestion }));

    expect(result).toMatchObject({
      statusId: POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_STATUS_IDS.OUTCOME_ONLY,
      requestTimeDecision: null,
      learningGuard: {
        canWriteLearning: false,
        profileRefreshQueued: false,
      },
      learningIntake: {
        version: 'policy.learning_intake.v1',
        sourceId: 'operator_confirmation',
        sourceEventId: 'classification:42',
      },
      audit: { ok: true },
    });
    expect(result.reasonCodes).toContain(
      POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_QUESTION_REDUCTION_PLAN,
    );
  });

  test('fails closed when fallback intake cannot normalize a tampered question frame', () => {
    const persistedQuestion = buildNativeQuestion();
    persistedQuestion.runtimeQuestion = {
      ...persistedQuestion.runtimeQuestion,
      frameId: 'caller_supplied_unknown_frame',
    };
    persistedQuestion.runtimeQuestionReductionPlan = {
      ...persistedQuestion.runtimeQuestionReductionPlan,
      trace: {
        ...persistedQuestion.runtimeQuestionReductionPlan.trace,
        attributes: {
          ...persistedQuestion.runtimeQuestionReductionPlan.trace.attributes,
          'classifarr.runtime.question.decision_evidence_projection_fingerprint': 'tampered',
        },
      },
    };

    const result = buildPolicyNativePendingResolutionProvenance(buildInput({ persistedQuestion }));

    expect(result.requestTimeDecision).toBeNull();
    expect(result.learningIntake).toEqual({
      version: 'policy.learning_intake.v1',
      sourceId: 'operator_confirmation',
      sourceEventId: 'classification:42',
      answerOutcomeId: 'resolve_current_item',
    });
    expect(result.learningGuard).toEqual(expect.objectContaining({
      decisionId: null,
      canWriteLearning: false,
      profileRefreshQueued: false,
    }));
    expect(result.audit).toEqual(expect.objectContaining({ ok: false }));
    expect(result.audit.issues.map(issue => issue.riskId)).toContain(
      POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.INVALID_LEARNING_INTAKE,
    );
  });

  test('does not authorize a caller-supplied label for an alternate destination', () => {
    const result = buildPolicyNativePendingResolutionProvenance(buildInput({
      selectedDestination: {
        libraryId: 9,
        libraryName: 'Movies',
      },
      selectedOption: 'Resolve current item',
    }));

    expect(result.selection.selectedOutcomeId).toBeNull();
    expect(result.requestTimeDecision).toBeNull();
    expect(result.reasonCodes).toContain(
      POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_REASON_IDS.INVALID_SELECTION,
    );
    expect(result.audit).toEqual(expect.objectContaining({ ok: false }));
  });

  test('projects a compact outcome patch without the transport label or actor identity', () => {
    const provenance = buildPolicyNativePendingResolutionProvenance(buildInput({
      selectedOption: 'Do not learn',
    }));
    const patch = buildNativePendingResolutionOutcomePatch(provenance);

    expect(patch).toEqual(expect.objectContaining({
      type: 'native_pending_resolution',
      source: 'policy_request_time',
      event_type_id: 'operator_confirmed_destination',
      selected_outcome_id: 'do_not_learn',
      suggested_library_id: 6,
      selected_library_id: 6,
      alternate_destination: false,
    }));
    expect(JSON.stringify(patch)).not.toContain('Do not learn');
    expect(JSON.stringify(patch)).not.toContain('admin@example.test');
  });

  test('rejects a tampered result that claims a direct provenance side effect', () => {
    const result = buildPolicyNativePendingResolutionProvenance(buildInput());
    const audit = buildPolicyNativePendingResolutionProvenanceAudit({
      ...result,
      sideEffects: {
        ...result.sideEffects,
        routingAttempted: true,
      },
    });

    expect(audit).toMatchObject({ ok: false, issueCount: 1 });
    expect(audit.issues[0].riskId).toBe(
      POLICY_NATIVE_PENDING_RESOLUTION_PROVENANCE_AUDIT_RISK_IDS.SIDE_EFFECT_REPORTED,
    );
  });
});
