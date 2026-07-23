import {
  POLICY_AUTHORING_COMPONENT_IDS,
  POLICY_AUTHORING_INTERACTION_RULE_IDS,
  POLICY_AUTHORING_OPTION_SOURCE_IDS,
} from '../../services/policyAuthoringComponentSystem.mjs';
import {
  POLICY_AUTHORING_DESTINATION_QUESTION_IDS,
} from '../../services/policyAuthoringDestinationFlow.mjs';
import {
  POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS,
  POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS,
  buildPolicyAuthoringMultiSelectCommandPlan,
  getPolicyAuthoringOptionSelectionSourceBehavior,
  isBroadIdentityGenre,
  listPolicyAuthoringOptionSelectionSourceBehaviors,
  normalizePolicyAuthoringOptionCandidate,
  summarizePolicyAuthoringOptionSelection,
  validatePolicyAuthoringCommandPlanBoundary,
  validatePolicyAuthoringOptionCandidate,
} from '../../services/policyAuthoringOptionSelection.mjs';

describe('policyAuthoringOptionSelection', () => {
  test('defines explicit source behavior for evidence-backed option groups', () => {
    expect(listPolicyAuthoringOptionSelectionSourceBehaviors().map(behavior => behavior.sourceId)).toEqual([
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
      POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
    ]);

    expect(getPolicyAuthoringOptionSelectionSourceBehavior(POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY))
      .toEqual(expect.objectContaining({
        selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.READ_ONLY_EVIDENCE,
        visibleGroupLabel: 'Already in this library',
        selectable: false,
        readOnlyEvidence: true,
        requiresEvidence: true,
        requiresExplicitAcceptance: true,
        canAutoDeclare: false,
      }));

    expect(getPolicyAuthoringOptionSelectionSourceBehavior(POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM))
      .toEqual(expect.objectContaining({
        selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.SELECTABLE_CUSTOM_VALUE,
        selectable: true,
        requiresExplanation: true,
      }));
  });

  test('normalizes observed evidence as read-only context that still requires acceptance', () => {
    const normalizedCandidate = normalizePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      evidenceCount: 42,
      confidence: 0.91,
      explanation: '42 existing items in this destination carry Animation metadata.',
    });

    expect(normalizedCandidate).toEqual(expect.objectContaining({
      value: 'Animation',
      label: 'Animation',
      sourceLabel: 'Already in this library',
      selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.READ_ONLY_EVIDENCE,
      selectable: false,
      readOnlyEvidence: true,
      requiresExplicitAcceptance: true,
      canAutoDeclare: false,
      commandId: null,
      evidence: {
        count: 42,
        confidence: 0.91,
      },
    }));
  });

  test('rejects observed evidence without evidence count or with auto declaration', () => {
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      explanation: 'Observed in this destination.',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.MISSING_EVIDENCE,
    }));

    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      evidenceCount: 3,
      autoDeclare: true,
      explanation: 'Observed in this destination.',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.OBSERVED_EVIDENCE_AUTO_DECLARED,
    }));
  });

  test('requires explanations for selectable suggestions and custom values', () => {
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Anime',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.MISSING_EXPLANATION,
    }));

    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Studio Ghibli',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
      explanation: 'Operator added a studio-specific identity signal.',
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('rejects broad non-observed identity genres without supporting evidence', () => {
    expect(isBroadIdentityGenre('Animation')).toBe(true);
    expect(isBroadIdentityGenre('Sci-Fi')).toBe(true);
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
      questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.BROAD_GENRE_WITHOUT_SUPPORTING_EVIDENCE,
    }));
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
      questionId: POLICY_AUTHORING_DESTINATION_QUESTION_IDS.WHAT_BELONGS_HERE,
      explanation: 'Suggested by an optional starter template.',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.BROAD_GENRE_WITHOUT_SUPPORTING_EVIDENCE,
    }));
  });

  test('requires disabled reasons for already-declared and conflicting choices', () => {
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.DISABLED_WITHOUT_REASON,
    }));

    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Horror',
      sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
      disabledReason: 'This destination currently avoids Horror.',
    })).toEqual(expect.objectContaining({
      valid: true,
      riskId: null,
    }));
  });

  test('builds typed multi-select command plans only for selectable valid options', () => {
    const commandPlan = buildPolicyAuthoringMultiSelectCommandPlan([
      {
        value: 'Anime',
        sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
        evidenceCount: 7,
        confidence: 0.8,
        explanation: 'Anime appears frequently in the current destination.',
      },
      {
        value: 'Studio Ghibli',
        sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
        explanation: 'Operator knows this destination is studio-specific.',
      },
      {
        value: 'Animation',
        sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
        evidenceCount: 42,
        explanation: 'Observed in this destination.',
      },
      {
        value: 'Family',
        sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
        disabledReason: 'Family is already declared.',
      },
    ]);

    expect(commandPlan).toEqual(expect.objectContaining({
      componentId: POLICY_AUTHORING_COMPONENT_IDS.INTENT_SIGNAL_PICKER,
      interactionRuleId: POLICY_AUTHORING_INTERACTION_RULE_IDS.ADD_VALUES_THROUGH_TYPED_DRAFT_COMMANDS,
      commandBoundary: 'typed_draft_commands',
      commandCount: 2,
      commands: [
        expect.objectContaining({
          commandId: POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS.ADD_SIGNAL_VALUE,
          value: 'Anime',
          sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
        }),
        expect.objectContaining({
          commandId: POLICY_AUTHORING_OPTION_SELECTION_COMMAND_IDS.ADD_SIGNAL_VALUE,
          value: 'Studio Ghibli',
          sourceId: POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
        }),
      ],
    }));

    expect(commandPlan.rejectedCandidates).toEqual([
      expect.objectContaining({
        value: 'Animation',
        valid: true,
        selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.READ_ONLY_EVIDENCE,
      }),
      expect.objectContaining({
        value: 'Family',
        valid: true,
        selectionStateId: POLICY_AUTHORING_OPTION_SELECTION_STATE_IDS.DISABLED_ALREADY_DECLARED,
      }),
    ]);
    expect(validatePolicyAuthoringCommandPlanBoundary(commandPlan)).toEqual({
      valid: true,
      riskId: null,
      reason: 'Multi-select option selection is constrained to typed draft commands.',
    });
  });

  test('fails closed for unknown source IDs and raw bridge command boundaries', () => {
    expect(validatePolicyAuthoringOptionCandidate({
      value: 'Animation',
      sourceId: 'legacy_dropdown_option',
    })).toEqual(expect.objectContaining({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.UNKNOWN_OPTION_SOURCE,
    }));

    expect(validatePolicyAuthoringCommandPlanBoundary({
      commandBoundary: 'raw_bridge_mutation',
    })).toEqual({
      valid: false,
      riskId: POLICY_AUTHORING_OPTION_SELECTION_RISK_IDS.RAW_BRIDGE_MUTATION,
      reason: 'Multi-select option selection must emit typed draft commands.',
    });
  });

  test('summarizes evidence fields and source states for the implementation checkpoint', () => {
    expect(summarizePolicyAuthoringOptionSelection()).toEqual({
      optionSourceCount: 7,
      selectableSourceIds: [
        POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_OBSERVED_PROFILE,
        POLICY_AUTHORING_OPTION_SOURCE_IDS.SUGGESTED_FROM_STARTER_TEMPLATE,
        POLICY_AUTHORING_OPTION_SOURCE_IDS.COMMON_STATIC_OPTION,
        POLICY_AUTHORING_OPTION_SOURCE_IDS.OPERATOR_ADDED_CUSTOM,
      ],
      readOnlyEvidenceSourceIds: [
        POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
      ],
      disabledSourceIds: [
        POLICY_AUTHORING_OPTION_SOURCE_IDS.OBSERVED_IN_LIBRARY,
        POLICY_AUTHORING_OPTION_SOURCE_IDS.ALREADY_DECLARED,
        POLICY_AUTHORING_OPTION_SOURCE_IDS.UNAVAILABLE_CONFLICTING_INTENT,
      ],
      evidenceFieldIds: [
        POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS.EVIDENCE_COUNT,
        POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS.CONFIDENCE,
        POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS.SOURCE_LABEL,
        POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS.EXPLANATION,
        POLICY_AUTHORING_OPTION_EVIDENCE_FIELD_IDS.DISABLED_REASON,
      ],
      observedEvidenceAutoDeclares: false,
      commandBoundary: 'typed_draft_commands',
    });
  });
});
