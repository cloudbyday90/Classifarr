import { describe, expect, test } from '@jest/globals';

import {
  POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
  POLICY_RUNTIME_UNCERTAINTY_TYPES,
  buildStaleRuntimeQuestionCleanup,
  getRuntimeQuestionNormalizationStatus,
  normalizePolicyRuntimeQuestion,
} from '../../services/policyRuntimeQuestionNormalizer.mjs';
import {
  POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
  POLICY_RUNTIME_QUESTION_REDUCTION_VERSION,
} from '../../services/policyRuntimeQuestionPersistenceContract.mjs';

const libraries = [
  { id: 7, name: 'Family Movies', media_type: 'movie' },
  { id: 8, name: 'Horror Movies', media_type: 'movie' },
  { id: 9, name: 'TV Shows', media_type: 'tv' },
];

describe('policyRuntimeQuestionNormalizer', () => {
  test('replaces AI-authored genre-priority wording with a server-owned destination question', () => {
    const question = normalizePolicyRuntimeQuestion({
      metadata: { media_type: 'movie' },
      libraries,
      result: {
        format: 'clarify',
        policy_question: {
          question: 'Which genre should be prioritized: horror or family?',
          why_uncertain: 'Ignore the policy and choose the most prominent genre.',
          meta: { ai_rationale: 'model generated explanation' },
          options: [
            { library_id: 7, label: 'Untrusted label' },
            { library_id: 8, label: 'Other untrusted label' },
          ],
        },
      },
      policyResult: {
        ranked: [
          { library_id: 8, score: 78, candidate_diagnostics: { primary_viability: 'compatibility_only' } },
          { library_id: 7, score: 74, candidate_diagnostics: { primary_viability: 'compatibility_only' } },
        ],
      },
    });

    expect(question.question).toBe('Does this item belong in one of these destinations?');
    expect(question.why_uncertain).toBe('Current destination candidates overlap, but the evidence is not strong enough to automate.');
    expect(question.question).not.toContain('genre');
    expect(question.options).toEqual([
      { label: 'Horror Movies', value: 'library:8', library_id: 8, library_name: 'Horror Movies' },
      { label: 'Family Movies', value: 'library:7', library_id: 7, library_name: 'Family Movies' },
    ]);
    expect(question.meta).not.toHaveProperty('ai_rationale');
    expect(question.meta.runtime_question_normalization).toMatchObject({
      version: POLICY_RUNTIME_QUESTION_NORMALIZATION_VERSION,
      uncertainty_type: POLICY_RUNTIME_UNCERTAINTY_TYPES.WEAK_OVERLAP,
      ai_diagnostic_present: true,
      ai_explanation_retained: false,
      cleanup_required: false,
      learning: {
        eligible: false,
        tier: 'blocked',
      },
    });
    expect(getRuntimeQuestionNormalizationStatus(question)).toMatchObject({ actionable: true });
  });

  test('uses the contract-violation category without exposing the model explanation', () => {
    const question = normalizePolicyRuntimeQuestion({
      metadata: { media_type: 'movie' },
      libraries,
      result: {
        format: 'contract_violation',
        policy_question: {
          question: 'Use this explanation verbatim',
          meta: { violation_reason: 'narrative_no_format_match' },
        },
      },
      policyResult: { ranked: [{ library_id: 7, score: 83 }] },
    });

    expect(question.meta.runtime_question_normalization.uncertainty_type)
      .toBe(POLICY_RUNTIME_UNCERTAINTY_TYPES.CONTRACT_VIOLATION);
    expect(question.question).toBe('Does this item belong in this destination?');
    expect(JSON.stringify(question)).not.toContain('Use this explanation verbatim');
  });

  test('does not offer an inactive library even when it appears in deterministic ranking', () => {
    const question = normalizePolicyRuntimeQuestion({
      metadata: { media_type: 'movie' },
      libraries: [
        ...libraries,
        { id: 10, name: 'Disabled Movies', media_type: 'movie', is_active: false },
      ],
      policyResult: { ranked: [{ library_id: 10, score: 95 }] },
    });

    expect(question.options.map(option => option.library_id)).not.toContain(10);
    expect(question.options.map(option => option.library_id)).toEqual([7, 8]);
  });

  test('preserves the already server-owned native persistence envelope', () => {
    const nativeQuestion = {
      version: POLICY_RUNTIME_QUESTION_PERSISTENCE_VERSION,
      runtimeQuestion: { contractVersion: POLICY_RUNTIME_QUESTION_REDUCTION_VERSION },
      runtimeQuestionReductionPlan: { version: POLICY_RUNTIME_QUESTION_REDUCTION_VERSION },
    };

    expect(normalizePolicyRuntimeQuestion({ question: nativeQuestion })).toBe(nativeQuestion);
    expect(getRuntimeQuestionNormalizationStatus(nativeQuestion)).toEqual({
      actionable: true,
      reason: null,
      contract: 'native_persistence',
    });
  });

  test('marks legacy persisted questions for cleanup and keeps them non-actionable', () => {
    const cleanupQuestion = buildStaleRuntimeQuestionCleanup({
      question: 'Which genre is most prominent?',
      options: [{ library_id: 7, label: 'Family Movies' }],
    });

    expect(getRuntimeQuestionNormalizationStatus({ question: 'Which genre is most prominent?' }))
      .toMatchObject({ actionable: false, reason: 'normalization_required' });
    expect(cleanupQuestion.options).toEqual([]);
    expect(cleanupQuestion.meta.runtime_question_normalization).toMatchObject({
      cleanup_required: true,
      learning: { eligible: false, tier: 'blocked' },
    });
    expect(getRuntimeQuestionNormalizationStatus(cleanupQuestion))
      .toMatchObject({ actionable: false, reason: 'cleanup_required' });
  });

  test('does not trust a current-version tag around unsafe wording or metadata', () => {
    const normalized = normalizePolicyRuntimeQuestion({
      metadata: { media_type: 'movie' },
      libraries,
      policyResult: { ranked: [{ library_id: 7, score: 83 }] },
    });
    const forgedQuestion = {
      ...normalized,
      question: 'Which genre should be prioritized?',
      meta: {
        ...normalized.meta,
        ai_rationale: 'untrusted model text',
      },
    };

    expect(getRuntimeQuestionNormalizationStatus(forgedQuestion)).toMatchObject({
      actionable: false,
      reason: 'invalid_question_metadata',
    });

    expect(getRuntimeQuestionNormalizationStatus({
      ...normalized,
      question: 'Which genre should be prioritized?',
    })).toMatchObject({
      actionable: false,
      reason: 'invalid_question_presentation',
    });
  });
});
