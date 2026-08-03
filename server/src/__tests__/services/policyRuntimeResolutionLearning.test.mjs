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
  POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS,
  buildPolicyRuntimeResolutionLearning,
  buildPolicyRuntimeResolutionLearningOutcomePatch,
} from '../../services/policyRuntimeResolutionLearning.mjs';

function normalizedQuestion({ frameId = 'missing_evidence', aiDiagnosticPresent = false } = {}) {
  return {
    question: 'Is there enough evidence to treat this as a match?',
    meta: {
      runtime_question_normalization: {
        frame_id: frameId,
        ai_diagnostic_present: aiDiagnosticPresent,
      },
    },
  };
}

function buildInput(overrides = {}) {
  return {
    classification: { id: 41 },
    question: normalizedQuestion(),
    destination: { libraryId: 7, libraryName: 'Movies' },
    selectedOption: 'Movies',
    answerContract: {
      actionId: 'confirm_destination',
    },
    actorId: 'operator-1',
    ...overrides,
  };
}

describe('policyRuntimeResolutionLearning', () => {
  test('records a bounded outcome-only guard decision for a current runtime answer', () => {
    const result = buildPolicyRuntimeResolutionLearning(buildInput());

    expect(result.audit).toEqual(expect.objectContaining({ ok: true }));
    expect(result).toEqual(expect.objectContaining({
      ok: true,
      statusId: 'outcome_only',
      sourceId: 'operator_confirmation',
      sourceEventId: 'classification:41:runtime-resolution',
      questionFrameId: 'missing_evidence',
      answerOutcomeId: 'resolve_current_item',
      decisionSummary: expect.objectContaining({
        decisionId: 'outcome_only',
        tierId: 'none',
        canWriteLearning: false,
        profileRefreshQueued: false,
      }),
    }));

    const patch = buildPolicyRuntimeResolutionLearningOutcomePatch(result);
    expect(patch).toEqual(expect.objectContaining({
      runtime_resolution_learning: expect.objectContaining({
        source_event_id: 'classification:41:runtime-resolution',
        question_frame_id: 'missing_evidence',
        answer_outcome_id: 'resolve_current_item',
        decision: expect.objectContaining({
          can_write_learning: false,
        }),
      }),
    }));
    expect(patch.runtime_resolution_learning).not.toHaveProperty('actor_id');
    expect(patch.runtime_resolution_learning).not.toHaveProperty('selected_option');
  });

  test('does not permit the legacy generate-rule request to become a durable write', () => {
    const result = buildPolicyRuntimeResolutionLearning(buildInput({
      question: null,
      answerContract: null,
      legacyRuleGenerationRequested: true,
    }));

    expect(result.audit.ok).toBe(true);
    expect(result).toEqual(expect.objectContaining({
      statusId: 'outcome_only',
      sourceId: 'manual_classification_change',
      answerOutcomeId: 'do_not_learn',
      decisionSummary: expect.objectContaining({
        canWriteLearning: false,
        tierId: 'none',
      }),
    }));
    expect(result.reasonCodes).toContain(
      POLICY_RUNTIME_RESOLUTION_LEARNING_REASON_IDS.LEGACY_RULE_GENERATION_BLOCKED,
    );
  });

  test('keeps route-not-applicable answers out of learning', () => {
    const result = buildPolicyRuntimeResolutionLearning(buildInput({
      answerContract: { actionId: 'route_not_applicable' },
    }));

    expect(result.audit.ok).toBe(true);
    expect(result.answerOutcomeId).toBe('do_not_learn');
    expect(result.decisionSummary).toEqual(expect.objectContaining({
      decisionId: 'outcome_only',
      canWriteLearning: false,
    }));
  });

  test('fails closed when a bounded intake event cannot be formed', () => {
    const result = buildPolicyRuntimeResolutionLearning(buildInput({
      classification: { id: null },
    }));

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      statusId: 'blocked',
    }));
    expect(result.audit.ok).toBe(false);
    expect(result.audit.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ riskId: 'runtime_resolution_incomplete_reference' }),
    ]));
  });
});
