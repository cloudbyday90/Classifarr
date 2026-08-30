/*
 * Classifarr - AI-powered media classification for the *arr ecosystem
 * Copyright (C) 2024-2026 Classifarr Contributors
 */

import { describe, expect, test } from '@jest/globals';

import {
  CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS,
  CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS,
  CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
  buildDeterministicOutcomeAiAbstentionResult,
  buildDeterministicOutcomeAiModeProjection,
  resolveDeterministicOutcomeAiMode,
} from '../../services/classificationDeterministicAiMode.mjs';

const libraries = [
  { id: 1, name: 'Movies', media_type: 'movie' },
  { id: 2, name: 'Family', media_type: 'movie' },
];

function policyResult({
  action = 'prompt_confirm',
  ranked = [{ library_id: 1, score: 80 }],
  library = { library_id: 1, library_name: 'Movies' },
  decisionDiagnostics = null,
} = {}) {
  return {
    action,
    ranked,
    library,
    confidence: 80,
    ...(decisionDiagnostics ? { decisionDiagnostics } : {}),
  };
}

describe('classificationDeterministicAiMode', () => {
  test.each([
    [
      'uses generic classification only when no policy outcome exists',
      { policyResult: null, libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.CLASSIFY,
      true,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.NO_POLICY_CANDIDATE,
    ],
    [
      'skips AI for deterministic auto classification even without ranked diagnostics',
      { policyResult: policyResult({ action: 'auto_classify', ranked: [] }), libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.SKIP,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.POLICY_AUTO,
    ],
    [
      'abstains when auto classification selects an unavailable destination',
      {
        policyResult: policyResult({
          action: 'auto_classify',
          ranked: [],
          library: { library_id: 999, library_name: 'Retired' },
        }),
        libraries,
      },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INVALID_POLICY_DESTINATION,
    ],
    [
      'requests verification for a unique reviewable candidate',
      { policyResult: policyResult(), libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.VERIFY,
      true,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.UNIQUE_REVIEW_CANDIDATE,
    ],
    [
      'abstains for ambiguous policy candidates',
      { policyResult: policyResult({ action: 'prompt_select' }), libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.AMBIGUOUS_POLICY_CANDIDATES,
    ],
    [
      'adjudicates only when a bounded prompt-select contract is valid',
      {
        policyResult: policyResult({
          action: 'prompt_select',
          ranked: [{ library_id: 1, score: 71 }, { library_id: 2, score: 69 }],
        }),
        libraries,
        candidateAdjudication: {
          valid: true,
          candidates: [{ libraryId: 1 }, { libraryId: 2 }],
        },
      },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ADJUDICATE,
      true,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.CANDIDATE_ADJUDICATION_READY,
    ],
    [
      'abstains for insufficient policy evidence',
      { policyResult: policyResult({ action: 'manual' }), libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INSUFFICIENT_POLICY_EVIDENCE,
    ],
    [
      'abstains when an otherwise unique result requires manual review',
      {
        policyResult: policyResult({
          decisionDiagnostics: { requires_manual_review: true },
        }),
        libraries,
      },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.MANUAL_REVIEW_REQUIRED,
    ],
    [
      'abstains when a review candidate is not an active destination',
      {
        policyResult: policyResult({
          ranked: [{ library_id: 999, score: 80 }],
          library: { library_id: 999, library_name: 'Retired' },
        }),
        libraries,
      },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.INVALID_POLICY_DESTINATION,
    ],
    [
      'abstains when policy evaluation failed instead of treating it as no policy',
      { policyEvaluationFailed: true, libraries },
      CLASSIFICATION_DETERMINISTIC_AI_MODE_IDS.ABSTAIN,
      false,
      CLASSIFICATION_DETERMINISTIC_AI_MODE_REASON_IDS.POLICY_EVALUATION_FAILED,
    ],
  ])('%s', (_label, input, mode, shouldInvoke, reasonCode) => {
    const decision = resolveDeterministicOutcomeAiMode(input);

    expect(decision).toMatchObject({
      version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
      mode,
      shouldInvoke,
      reasonCode,
    });
  });

  test('builds an operator-review result without granting an AI route', () => {
    const aiModeDecision = resolveDeterministicOutcomeAiMode({
      policyResult: policyResult({ action: 'prompt_select' }),
      libraries,
    });
    const result = buildDeterministicOutcomeAiAbstentionResult({
      policyResult: policyResult({ action: 'prompt_select' }),
      libraries,
      signalContext: { confidence: 80 },
      aiModeDecision,
    });

    expect(result).toMatchObject({
      library: libraries[0],
      confidence: 80,
      method: 'policy_engine',
      needs_clarification: true,
      deterministic_ai_mode: aiModeDecision,
    });
    expect(result.ai_authority).toBeUndefined();
  });

  test('projects only bounded deterministic mode facts', () => {
    const projection = buildDeterministicOutcomeAiModeProjection({
      ...resolveDeterministicOutcomeAiMode({ policyResult: policyResult(), libraries }),
      title: 'Do not persist this',
      providerOutput: 'Do not persist this either',
    });

    expect(projection).toEqual({
      version: CLASSIFICATION_DETERMINISTIC_AI_MODE_VERSION,
      mode: 'verify',
      invoked: true,
      reason_code: 'unique_review_candidate',
      policy_action: 'prompt_confirm',
      candidate_count: 1,
    });
  });
});
