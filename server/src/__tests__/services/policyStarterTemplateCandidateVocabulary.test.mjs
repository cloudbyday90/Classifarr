import {
  POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS,
  POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS,
  POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS,
  canProjectPolicyStarterTemplateCandidate,
  getPolicyStarterTemplateCandidateVocabularyDecision,
  listPolicyStarterTemplateCandidateVocabulary,
  listPolicyStarterTemplatePurposeCandidateSignalEntries,
} from '../../services/policyStarterTemplateCandidateVocabulary.mjs';

describe('policyStarterTemplateCandidateVocabulary', () => {
  test('projects only require-any purpose values with an existing typed command owner', () => {
    expect(listPolicyStarterTemplatePurposeCandidateSignalEntries()).toEqual([
      expect.objectContaining({ signalTypeId: 'genres', operatorId: 'require_any' }),
      expect.objectContaining({ signalTypeId: 'keywords', operatorId: 'require_any' }),
      expect.objectContaining({ signalTypeId: 'studios', operatorId: 'require_any' }),
    ]);

    expect(canProjectPolicyStarterTemplateCandidate({
      signalType: 'genres',
      operator: 'require_any',
    })).toBe(true);
    expect(canProjectPolicyStarterTemplateCandidate({
      signalType: 'language',
      operator: 'require_any',
    })).toBe(false);
  });

  test('keeps template prefer values out of the normal workflow until helpful candidates have an owner', () => {
    expect(getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'keywords',
      operator: 'prefer',
    })).toEqual(expect.objectContaining({
      candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HELPFUL_HINT,
      projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
      componentId: null,
      commandId: null,
      candidateInputContractAvailable: false,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .HELPFUL_CONTROL_NOT_IMPLEMENTED,
    }));
  });

  test('does not translate legacy certification inclusion into the incompatible max-rating hard limit', () => {
    expect(getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'certifications',
      operator: 'include',
    })).toEqual(expect.objectContaining({
      candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HARD_LIMIT,
      projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
      componentId: 'hard_limit_control',
      commandId: 'set_hard_limit',
      explicitOperatorConfirmationRequired: true,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .HARD_LIMIT_SEMANTICS_DO_NOT_MATCH,
    }));

    expect(getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'runtime',
      operator: 'max_minutes',
    })).toEqual(expect.objectContaining({
      candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.HARD_LIMIT,
      projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
      componentId: null,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .HARD_LIMIT_CONTROL_NOT_IMPLEMENTED,
    }));
  });

  test('keeps template exclusions out of avoid controls until a source-aware candidate contract exists', () => {
    expect(getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'certifications',
      operator: 'exclude',
    })).toEqual(expect.objectContaining({
      candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.AVOID,
      projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
      componentId: 'avoid_control',
      commandId: 'add_avoid_value',
      candidateInputContractAvailable: false,
      explicitOperatorConfirmationRequired: true,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .AVOID_CANDIDATE_INPUT_NOT_IMPLEMENTED,
    }));

    expect(getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'keywords',
      operator: 'exclude',
    })).toEqual(expect.objectContaining({
      candidateBucketId: POLICY_STARTER_TEMPLATE_CANDIDATE_BUCKET_IDS.AVOID,
      componentId: null,
      commandId: null,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .AVOID_CONTROL_NOT_IMPLEMENTED,
    }));
  });

  test('returns an immutable fail-closed decision for unsupported template vocabulary', () => {
    const vocabulary = listPolicyStarterTemplateCandidateVocabulary();
    const unsupported = getPolicyStarterTemplateCandidateVocabularyDecision({
      signalType: 'media_type',
      operator: 'include',
    });

    expect(Object.isFrozen(vocabulary)).toBe(true);
    expect(Object.isFrozen(vocabulary[0])).toBe(true);
    expect(unsupported).toEqual(expect.objectContaining({
      projectionActionId: POLICY_STARTER_TEMPLATE_CANDIDATE_PROJECTION_ACTION_IDS.DO_NOT_PROJECT,
      decisionReasonId: POLICY_STARTER_TEMPLATE_CANDIDATE_DECISION_REASON_IDS
        .UNSUPPORTED_TEMPLATE_VOCABULARY,
    }));
  });
});
